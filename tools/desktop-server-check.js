// Regression checks for the desktop relay. No network or Electron install needed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const {EventEmitter} = require('node:events');

(async () => {
  const requests = [], failures = [];
  let payload = {}, dispatch;
  const testRequire = name => name === 'node:http' ? {createServer(handler) {
    dispatch = handler;
    return {listen(port, host, ready) { ready(); }, address:() => ({port:1234}), on() {}};
  }} : require(name);
  const context = vm.createContext({require:testRequire, module:{exports:{}}, __dirname:path.resolve('electron'), process, Buffer, URL, AbortSignal,
    fetch:async (target, options) => { requests.push({target, options}); return new Response(JSON.stringify(payload)); }});
  vm.runInContext(fs.readFileSync(process.argv[2] || 'electron/main.js', 'utf8'), context);
  const response = () => ({writeHead(status) { this.status = status; }, end(body) { this.body = body; }});
  const check = async (name, run) => { try { await run(); console.log('PASS ' + name); } catch (err) { failures.push(name + ': ' + err.message); } };
  await context.module.exports.startServer();
  await check('Scryfall query reaches upstream and separates cache entries', async () => {
    for (const name of ['Review Card A', 'Review Card B']) {
      const req = new EventEmitter(), res = response();
      req.method = 'GET'; req.url = '/sf/cards/named?exact=' + encodeURIComponent(name) + '&review=' + Date.now();
      const done = new Promise(resolve => { res.end = resolve; });
      await dispatch(req, res); req.emit('end'); await done;
      assert.equal(new URL(requests.at(-1).target).searchParams.get('exact'), name);
    }
  });
  await check('Deck suggestions use similar cards and shared-deck data on a fixed host', async () => {
    payload={similar:['Mission Briefing'],container:{json_dict:{cardlists:[{tag:'topcommanders',cardviews:[{name:'Not a recommendation'}]},{tag:'highliftcards',cardviews:[{name:'Torrential Gearhulk'}]}]}}};
    const res=response(); await dispatch({method:'GET',url:'/suggest/review-snapcaster-'+Date.now()},res);
    assert.equal(res.status,200); assert.deepEqual(JSON.parse(res.body).cards.map(c=>c.name),['Mission Briefing','Torrential Gearhulk']);
    assert.equal(new URL(requests.at(-1).target).hostname,'json.edhrec.com');
    const count=requests.length, bad=response(); await dispatch({method:'GET',url:'/suggest/https:%2f%2fevil.example'},bad);
    assert.equal(bad.status,404); assert.equal(requests.length,count);
  });
  await check('Archidekt excludes maybeboard and keeps sideboard', async () => {
    payload = {name:'Deck', categories:[{name:'Maybeboard', includedInDeck:false}, {name:'Sideboard', includedInDeck:false}],
      cards:[{quantity:1, categories:['Maybeboard'], card:{oracleCard:{name:'Excluded'}}},
        {quantity:2, categories:['Sideboard'], card:{name:'Sideboard card'}},
        {quantity:1, categories:['Mainboard'], card:{oracleCard:{name:'Main card'}}}]};
    context.res = response();
    await vm.runInContext("handleDeck({}, res, new URL('http://localhost/deck?u=https://archidekt.com/decks/123'))", context);
    const result = JSON.parse(context.res.body);
    assert.equal(result.text, '2 Sideboard card\n1 Main card');
    assert.equal(result.name, 'Deck');
  });
  await check('Malformed asset URL is rejected without throwing', () => {
    assert.equal(vm.runInContext("safeAssetPath('/assets/%ZZ')", context), null);
  });
  await check('Relay rejects unknown paths, methods and oversized requests', async () => {
    const count = requests.length;
    for (const [method, url, status] of [['GET', '/sf/account', 404], ['POST', '/sf/cards/search', 404], ['GET', '/mpc/admin/', 404], ['DELETE', '/sf/cards/named', 405]]) {
      const res = response(); await dispatch({method, url}, res); assert.equal(res.status, status);
    }
    const req = new EventEmitter(), res = response(); req.method = 'POST'; req.url = '/sf/cards/collection';
    await dispatch(req, res); req.emit('data', Buffer.alloc(256 * 1024 + 1)); req.emit('end');
    assert.equal(res.status, 413); assert.equal(requests.length, count);
  });
  await check('Oversized upstream response is rejected', async () => {
    context.upstream = new Response(Buffer.alloc(20 * 1024 * 1024 + 1));
    await assert.rejects(vm.runInContext('readUpstream(upstream)', context), /Response too large/);
  });
  await check('Navigation checks exact origin and never opens file URLs', () => {
    const handlers = {}, opened = [];
    context.win = {webContents:{setWindowOpenHandler(fn) { handlers.open = fn; }, on(name, fn) { handlers[name] = fn; }}};
    context.testShell = {openExternal:target => opened.push(target)};
    vm.runInContext("shell = testShell; configureNavigation(win, 'http://127.0.0.1:8642')", context);
    for (const target of ['https://example.com/127.0.0.1:8642', 'file:///tmp/test', 'http://127.0.0.1:8642/']) {
      let prevented = false; handlers['will-navigate']({preventDefault() { prevented = true; }}, target);
      assert.equal(prevented, !target.startsWith('http://127.0.0.1:8642/'));
    }
    assert.deepEqual(opened, ['https://example.com/127.0.0.1:8642']);
    handlers.open({url:'file:///tmp/test'}); assert.equal(opened.length, 1);
    assert.equal(typeof handlers['will-redirect'], 'function');
  });
  if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
})();
