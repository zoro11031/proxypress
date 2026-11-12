#!/usr/bin/env node
// Automates the console check that AGENTS.md asks for: load the page, watch for
// errors, and look for CSP violations, which the strict CSP otherwise turns into
// silent failures.
//
// Needs node 22+ (built-in fetch and WebSocket) and chromium on PATH. No npm
// packages, nothing added to the page.
//
//   node tools/console-check.js                      # start a server, check the page
//   --artifacts /tmp/result.json writes window.__probeArtifacts when the probe returns true.
//   --width 1440 --height 1000 --screenshot /tmp/workspace.png captures the checked page.
//   node tools/console-check.js --probe my-probe.js  # also run assertions in the page
//   node tools/console-check.js --url http://host:port --password pw
//
// Exit codes:  0 clean   1 findings or failed assertions   2 inconclusive
//
// Three things here are not obvious and each one was a real false pass:
//
//   1. CSP violations arrive on CDP Log.entryAdded with source "security", never on
//      Runtime.consoleAPICalled, and they lag the action by up to ~2.5s. Watching
//      only consoleAPICalled, or stopping early, reports a clean page while the CSP
//      is quietly blocking.
//   2. A clean result means nothing unless the listener was live when it was
//      collected: a dead listener and a clean page emit identical output. Proving
//      the listener in a separate run does not transfer, so this forces a violation
//      per collection channel in the same run and refuses to report clean unless
//      every one is caught, matched on a marker unique to that probe. Channel alone
//      is not enough - two probes share the csp channel, and a slow violation from
//      one can land in the next one's window.
//   3. An injected probe passes whatever page is loaded. If the page is not the app
//      at all - a failed login serves the login form, which has no app script and so
//      no violations to produce - everything above still comes back green. So the
//      app is checked for separately, and its absence outranks every other result.
//
// A note on cleanup: stale browsers and servers are reaped at the START of a run,
// not only at the end. A cleanup line that never executes leaves the port held
// while the surrounding output still reads as a normal completion, so an end-only
// cleanup leaks indefinitely. Everything long-lived also gets a deadline at launch,
// which is the one protection that survives the cleanup never running.

const {spawn, execFileSync} = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SETTLE = 3000;                       // > the ~2.5s violation latency
const PROF = path.join(os.tmpdir(), `pp-console-check-${process.pid}`);
const sh = (cmd, args) => { try { return execFileSync(cmd, args, {encoding: 'utf8'}); } catch { return ''; } };

function reap() {
  // Only ever our own: profiles matching this tool's prefix, servers on our port range.
  for (const line of sh('ps', ['-eo', 'pid=,args=']).split('\n')) {
    const m = line.trim().match(/^(\d+)\s+(.*)$/); if (!m) continue;
    const [, pid, args] = m;
    if (args.includes('shell-snapshots') || args.includes('console-check.js')) continue;
    const stale = /chromium.*user-data-dir=.*pp-console-check-/.test(args) ||
      (/proxy-press-server\.py\s+(\d+)/.test(args) && +RegExp.$1 >= 8650 && +RegExp.$1 <= 8699);
    if (stale) { console.log(`  reap: stale pid ${pid}`); try { process.kill(+pid); } catch {} }
  }
}
const portFree = p => !sh('ss', ['-ltnH', `sport = :${p}`]).trim();
const freePort = lo => { for (let p = lo; p < lo + 60; p++) if (portFree(p)) return p; throw new Error('no free port'); };
// Prove the listener on this port is the chromium we just launched, by profile.
// Matching the binary name is useless: another session's browser is also chromium.
function owns(port) {
  const out = sh('ss', ['-ltnpH', `sport = :${port}`]);
  const pids = [...out.matchAll(/pid=(\d+)/g)].map(m => m[1]);
  if (!pids.length) return `nothing listening on ${port}`;
  for (const pid of pids)
    if (!sh('ps', ['-p', pid, '-o', 'args=']).includes(`user-data-dir=${PROF}`))
      return `port ${port} held by pid ${pid} with another profile`;
  return null;
}

(async () => {
  let server, browser, rc = 2;
  const stop = () => {
    for (const p of [browser, server]) { try { p && p.kill(); } catch {} }
    try { fs.rmSync(PROF, {recursive: true, force: true}); } catch {}
  };
  process.on('exit', stop);
  try {
    reap();
    let url = arg('--url'), password = arg('--password', 'consolecheck');
    if (!url) {
      const sp = freePort(8650);
      url = `http://127.0.0.1:${sp}`;
      server = spawn('python3', ['proxy-press-server.py', String(sp)],
        {env: {...process.env, PASSWORD: password, NO_BROWSER: '1'}, stdio: 'ignore'});
      setTimeout(() => { try { server.kill(); } catch {} }, 180000).unref();   // deadline at launch
      for (let i = 0; i < 60 && portFree(sp); i++) await sleep(250);
    }
    const cdp = freePort(9400);
    // A desktop viewport, pinned. Headless chromium defaults to 780x493 here, under the
    // 821px breakpoint, so the page loads its narrow layout: the sidebar toggle is
    // display:none and preview focus mode does not exist. A probe asserting anything
    // about the desktop layout then fails for the window size rather than the code,
    // and the default is not contractual, so it has to be stated.
    browser = spawn('chromium', ['--headless=new', `--remote-debugging-port=${cdp}`, '--no-first-run',
      '--no-default-browser-check', '--disable-gpu', '--window-size=1280,900',
      `--user-data-dir=${PROF}`, 'about:blank'], {stdio: 'ignore'});
    setTimeout(() => { try { browser.kill(); } catch {} }, 180000).unref();
    for (let i = 0; i < 60; i++) { try { await fetch(`http://127.0.0.1:${cdp}/json/version`); break; } catch { await sleep(250); } }
    let bad = owns(cdp);
    if (bad) { console.log(`INCONCLUSIVE - ${bad}`); process.exit(2); }

    const targets = await (await fetch(`http://127.0.0.1:${cdp}/json/list`)).json();
    const target = targets.find(t => t.type === 'page');
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    let id = 0; const events = [];
    await new Promise(r => ws.onopen = r);
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type))
        events.push(['console', m.params.args.map(a => a.value ?? a.description ?? a.type).join(' ')]);
      else if (m.method === 'Runtime.exceptionThrown')
        events.push(['exception', m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text]);
      else if (m.method === 'Log.entryAdded' && m.params.entry.level !== 'info')
        events.push([m.params.entry.source === 'security' ? 'csp' : 'log/' + m.params.entry.source, m.params.entry.text]);
    };
    const send = (method, params) => ws.send(JSON.stringify({id: ++id, method, params}));
    const ev = expr => new Promise(res => {
      const myId = ++id;
      const h = e => { const m = JSON.parse(e.data); if (m.id === myId) { ws.removeEventListener('message', h); res(m.result?.result?.value); } };
      ws.addEventListener('message', h);
      ws.send(JSON.stringify({id: myId, method: 'Runtime.evaluate', params: {expression: expr, returnByValue: true, awaitPromise: true}}));
    });

    send('Runtime.enable'); send('Log.enable');
    if (arg('--width')) send('Emulation.setDeviceMetricsOverride', {width:+arg('--width'), height:+arg('--height', '1000'), deviceScaleFactor:1, mobile:false});
    send('Page.navigate', {url: url + '/'});
    await sleep(2500);
    await ev(`(()=>{const p=document.querySelector('input[type=password]');` +
             `if(p){p.value=${JSON.stringify(password)};p.form.submit();}return 1;})()`);
    await sleep(SETTLE + 2000);

    const loaded = await ev("typeof layout==='function' && typeof cleanSettings==='function'");
    let probeOut = null, probeFile = arg('--probe');
    if (loaded && probeFile) probeOut = await ev(fs.readFileSync(probeFile, 'utf8'));
    if (probeOut === true && arg('--artifacts')) fs.writeFileSync(arg('--artifacts'), JSON.stringify(await ev('window.__probeArtifacts')));
    await sleep(SETTLE);
    if (arg('--screenshot')) {
      const shot = await new Promise(resolve => {
        const myId = ++id;
        const h = e => { const m = JSON.parse(e.data); if (m.id === myId) { ws.removeEventListener('message', h); resolve(m.result); } };
        ws.addEventListener('message', h);
        ws.send(JSON.stringify({id:myId, method:'Page.captureScreenshot', params:{format:'png'}}));
      });
      fs.writeFileSync(arg('--screenshot'), Buffer.from(shot.data, 'base64'));
    }
    // Chromium's "recommendation" source is advisory DOM guidance, not an error.
    // Reported so nothing is hidden, but it does not fail the run.
    const isNote = ([c]) => c === 'log/recommendation';
    const real = events.filter(e => !isNote(e));
    const notes = events.filter(isNote);

    const control = async label => { const n = events.length; await ev('1'); await sleep(SETTLE); return [label, events.length === n]; };
    const controls = [await control('no-op before probes')];
    const probes = [
      ['csp', /ccheck\.invalid/, 'blocked image host', "const i=document.createElement('img');i.src='https://ccheck.invalid/x.png';document.body.appendChild(i);1"],
      ['csp', /inline script/i, 'blocked inline script', "const s=document.createElement('script');s.textContent='window.__cc=1';document.body.appendChild(s);1"],
      ['console', /__ccheck__/, 'console.error', "console.error('__ccheck__');1"],
      ['exception', /__ccheck__/, 'uncaught throw', "setTimeout(()=>{throw new Error('__ccheck__')},0);1"],
    ];
    const results = [];
    for (const [chan, marker, name, expr] of probes) {
      const n = events.length; await ev(expr); await sleep(SETTLE);
      const seen = events.slice(n);
      results.push([name, chan, seen.some(([c, t]) => c === chan && marker.test(t)), seen.map(([c]) => c).join(',')]);
    }
    controls.push(await control('no-op after probes'));

    console.log(`\napp loaded: ${loaded ? 'yes' : 'NO'}`);
    if (probeOut !== null) console.log('probe: ' + JSON.stringify(probeOut));
    console.log(`\nFINDINGS (${real.length}):`);
    for (const [k, v] of real) console.log('  [' + k + '] ' + String(v).slice(0, 300));
    if (notes.length) {
      console.log(`\nNOTES (${notes.length}, advisory, do not fail the run):`);
      for (const [k, v] of notes) console.log('  [' + k + '] ' + String(v).slice(0, 200));
    }
    console.log('\nSELF-TEST:');
    for (const [name, chan, ok, other] of results)
      console.log(`  [${ok ? 'ok  ' : 'DEAD'}] ${name.padEnd(22)} -> ${chan}` + (!ok && other ? `   *** target missed, only ${other} fired ***` : ''));
    for (const [label, ok] of controls) console.log(`  [${ok ? 'ok  ' : 'NOISY'}] ${label.padEnd(22)} -> expects nothing`);
    const dead = results.filter(r => !r[2]), noisy = controls.filter(c => !c[1]);
    console.log(`\n  ${results.length - dead.length}/${results.length} channels proven live, ${controls.length - noisy.length}/${controls.length} controls clean`);

    if (!loaded) { console.log('\nINCONCLUSIVE - the app never loaded, so nothing here is about the page.'); rc = 2; }
    else if (noisy.length) { console.log('\nINCONCLUSIVE - a no-op produced events; nothing is attributable.'); rc = 2; }
    else if (dead.length) { console.log('\nINCONCLUSIVE - a channel never fired when forced; a clean result on it would hide every future violation.'); rc = 2; }
    else if (real.length) { console.log(`\nFAIL - ${real.length} finding(s); harness proven live.`); rc = 1; }
    // Anything other than exactly true is a failure. Checking only for `false` let a
    // probe reporting {failed:[...]} pass silently, which it did on this tool's first
    // run against a deliberately reintroduced bug.
    else if (probeFile && probeOut !== true) {
      console.log('\nFAIL - probe did not return true: ' + JSON.stringify(probeOut)); rc = 1; }
    else { console.log('\nPASS - page clean, all channels proven live in this run.'); rc = 0; }
    try { ws.send(JSON.stringify({id: ++id, method: 'Browser.close'})); await sleep(700); } catch {}
  } catch (e) {
    console.log('INCONCLUSIVE - harness error: ' + e.message); rc = 2;
  }
  stop();
  process.exit(rc);
})();
