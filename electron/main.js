// SPDX-License-Identifier: GPL-3.0-or-later
let app, BrowserWindow, shell, Menu, protocol, net;
try {
  ({ app, BrowserWindow, shell, Menu, protocol, net } = require('electron'));
} catch {}
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const MAX_BODY = 256 * 1024, MAX_UPSTREAM = 20 * 1024 * 1024, MAX_CACHE_FILES = 5000;
const MPC_PATHS = new Set(['2/editorSearch/', '2/cards/', '2/sources/', '2/cardbacks/', '2/languages/', '2/DFCPairs/']);
let lastCachePrune = 0;
let sfQueue = Promise.resolve();
let sfLastCall = 0;

async function readUpstream(response, limit = MAX_UPSTREAM) {
  const chunks = []; let size = 0;
  for await (const chunk of response.body || []) {
    size += chunk.length;
    if (size > limit) throw new Error('Response too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function configureNavigation(win, serverUrl) {
  const external = target => { if (/^https?:\/\//i.test(target)) shell.openExternal(target); };
  win.webContents.setWindowOpenHandler(({url:target}) => { external(target); return {action:'deny'}; });
  const navigate = (event, target) => {
    try { if (new URL(target).origin === serverUrl) return; } catch {}
    event.preventDefault(); external(target);
  };
  win.webContents.on('will-navigate', navigate);
  win.webContents.on('will-redirect', navigate);
}

function getResourcePath(...subpaths) {
  if (app && app.isPackaged) {
    const packaged = path.join(process.resourcesPath, ...subpaths);
    if (fs.existsSync(packaged)) return packaged;
    const asar = path.join(__dirname, ...subpaths);
    if (fs.existsSync(asar)) return asar;
  }
  const local = path.join(__dirname, ...subpaths);
  if (fs.existsSync(local)) return local;
  const parent = path.join(__dirname, '..', ...subpaths);
  if (fs.existsSync(parent)) return parent;
  return local;
}

const htmlFile = getResourcePath('proxy-press.html');
const ogImage = getResourcePath('og.png');
const assetsDir = getResourcePath('assets');
const cacheDir = app ? path.join(app.getPath('userData'), 'cache') : path.join(__dirname, 'cache');
try { fs.mkdirSync(cacheDir, { recursive: true }); } catch {}

const ASSET_TYPES = {
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.studio3': 'application/octet-stream',
  '.js': 'application/javascript; charset=utf-8',
  'style': 'text/plain'
};

function pageCsp(htmlContent) {
  const hashes = [...htmlContent.matchAll(/<script>(.*?)<\/script>/gs)]
    .map(m => `'sha256-${crypto.createHash('sha256').update(m[1]).digest('base64')}'`)
    .join(' ');
  return [
    "default-src 'self'",
    `script-src 'self' ${hashes} https://cdnjs.cloudflare.com`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data: blob: https://cards.scryfall.io https://svgs.scryfall.io https://img.mpcautofill.com https://cdn.mpcautofill.com",
    "connect-src 'self' data: blob: https://api.scryfall.com https://cards.scryfall.io https://img.mpcautofill.com https://cdn.mpcautofill.com",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ].join('; ');
}

function assetManifest() {
  const fonts = [];
  const frames = [];
  const fontDir = path.join(assetsDir, 'fonts');
  const frameDir = path.join(assetsDir, 'frames');
  if (fs.existsSync(fontDir) && fs.statSync(fontDir).isDirectory()) {
    for (const file of fs.readdirSync(fontDir)) {
      if (['.ttf', '.otf', '.woff', '.woff2'].includes(path.extname(file).toLowerCase())) {
        fonts.push(file);
      }
    }
    fonts.sort();
  }
  if (fs.existsSync(frameDir) && fs.statSync(frameDir).isDirectory()) {
    for (const name of fs.readdirSync(frameDir)) {
      const d = path.join(frameDir, name);
      const stylePath = path.join(d, 'style');
      if (fs.statSync(d).isDirectory() && fs.existsSync(stylePath)) {
        const files = fs.readdirSync(d).filter(f => fs.statSync(path.join(d, f)).isFile()).sort();
        const style = fs.readFileSync(stylePath, 'utf8');
        frames.push({ name, files, style });
      }
    }
    frames.sort((a, b) => a.name.localeCompare(b.name));
  }
  return { fonts, frames };
}

function safeAssetPath(reqRoute) {
  let rel;
  try { rel = decodeURIComponent(reqRoute.slice('/assets/'.length)); } catch { return null; }
  if (rel.includes('\0')) return null;
  let rootReal, full;
  try {
    rootReal = fs.realpathSync(assetsDir);
    full = fs.realpathSync(path.join(assetsDir, rel));
  } catch { return null; }
  if (!full.startsWith(rootReal + path.sep) || !fs.statSync(full).isFile()) {
    return null;
  }
  const ext = path.extname(full).toLowerCase();
  const ctype = ASSET_TYPES[ext] || (path.basename(full) === 'style' ? 'text/plain' : null);
  return ctype ? { full, ctype } : null;
}

function cacheKey(key) {
  return path.join(cacheDir, crypto.createHash('sha256').update(key).digest('hex') + '.json');
}

function cacheGet(key, ttlSec = 3 * 86400) {
  try {
    const f = cacheKey(key);
    if (fs.existsSync(f)) {
      const [ts, data] = JSON.parse(fs.readFileSync(f, 'utf8'));
      if (Date.now() / 1000 - ts < ttlSec) return data;
    }
  } catch {}
  return null;
}

function cachePut(key, data) {
  try {
    const now = Date.now() / 1000;
    const f = cacheKey(key);
    const tmp = `${f}.${process.pid}.${Math.random().toString(36).slice(2, 8)}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify([now, data]), 'utf8');
    fs.renameSync(tmp, f);
    if (now - lastCachePrune > 3600) {
      lastCachePrune = now;
      try {
        const files = fs.readdirSync(cacheDir)
          .filter(n => n.endsWith('.json'))
          .map(n => {
            const p = path.join(cacheDir, n);
            try { return { p, m: fs.statSync(p).mtimeMs / 1000 }; } catch { return null; }
          })
          .filter(Boolean)
          .sort((a, b) => a.m - b.m);
        for (let i = 0; i < files.length; i++) {
          if (now - files[i].m > 14 * 86400 || files.length - i > MAX_CACHE_FILES) {
            try { fs.unlinkSync(files[i].p); } catch {}
          }
        }
      } catch {}
    }
  } catch {}
}

function waitSfSlot() {
  sfQueue = sfQueue.then(async () => {
    const wait = 100 - (Date.now() - sfLastCall);
    if (wait > 0 && typeof setTimeout === 'function') await new Promise(r => setTimeout(r, wait));
    sfLastCall = Date.now();
  });
  return sfQueue;
}

async function handleMpc(req, res, method, reqPath, body) {
  const targetUrl = 'https://mpcfill.com' + reqPath.slice('/mpc'.length);
  const bodyHash = crypto.createHash('sha256').update(body || Buffer.alloc(0)).digest('hex');
  const cKey = `mpc:${method}:${reqPath}:${bodyHash}`;
  const hit = cacheGet(cKey, 3 * 86400);
  if (hit !== null) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(req.method === 'HEAD' ? undefined : hit);
  }
  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Origin': 'https://mpcfill.com',
      'Referer': 'https://mpcfill.com/',
      'Accept': 'application/json'
    };
    if (body) headers['Content-Type'] = 'application/json';

    const upstream = await fetch(targetUrl, {
      method,
      headers,
      signal: AbortSignal.timeout(60000), redirect:'error',
      body: body && body.length ? body : undefined
    });
    const data = await readUpstream(upstream);
    if (upstream.status === 200) cachePut(cKey, data.toString('utf8'));
    res.writeHead(upstream.status, {
      'Content-Type': 'application/json'
    });
    res.end(req.method === 'HEAD' ? undefined : Buffer.from(data));
  } catch (err) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ name: 'Relay error', message: 'Could not reach mpcfill.com' }));
  }
}

async function handleSf(req, res, method, reqPath, body) {
  const targetUrl = 'https://api.scryfall.com' + reqPath.slice('/sf'.length);
  const bodyHash = method === 'POST' ? ':' + crypto.createHash('sha256').update(body || Buffer.alloc(0)).digest('hex') : '';
  const cKey = `sf:${method}:${targetUrl}${bodyHash}`;
  const cacheHit = cacheGet(cKey, 3 * 86400);
  if (cacheHit) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(req.method === 'HEAD' ? undefined : cacheHit);
  }
  try {
    await waitSfSlot();
    const headers = {
      'User-Agent': 'ProxyPress/1.0',
      'Accept': 'application/json'
    };
    if (body) headers['Content-Type'] = 'application/json';

    const upstream = await fetch(targetUrl, {
      method,
      headers,
      signal: AbortSignal.timeout(60000), redirect:'error',
      body: body && body.length ? body : undefined
    });
    const text = (await readUpstream(upstream)).toString('utf8');
    if (upstream.status === 200) {
      cachePut(cKey, text);
    }
    // Same as the Python relay: an empty result is a 200 carrying Scryfall's error object.
    let status = upstream.status;
    if (status === 404) { try { if (JSON.parse(text).object === 'error') status = 200; } catch {} }
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(req.method === 'HEAD' ? undefined : text);
  } catch (err) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Could not reach Scryfall' }));
  }
}

async function handleSym(req, res, reqPath) {
  const name = reqPath.slice('/sym/'.length);
  const hit = cacheGet('sym:' + name);
  if (hit) {
    const ctype = name === 'index.json' ? 'application/json' : 'image/svg+xml';
    res.writeHead(200, { 'Content-Type': ctype, 'Cache-Control': 'public, max-age=86400' });
    return res.end(hit);
  }

  try {
    if (name === 'index.json') {
      const upstream = await fetch('https://api.scryfall.com/symbology', { headers: { 'User-Agent': 'ProxyPress/1.0' }, signal:AbortSignal.timeout(30000), redirect:'error' });
      if (!upstream.ok) throw new Error('Symbology unavailable');
      const data = JSON.parse(await readUpstream(upstream));
      const map = {};
      for (const s of data.data || []) {
        if (s.svg_uri) {
          const rawName = s.svg_uri.split('/').pop().split('?')[0];
          map[s.symbol] = '/sym/' + rawName;
        }
      }
      const out = JSON.stringify(map);
      cachePut('sym:index.json', out);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(out);
    } else {
      const upstream = await fetch('https://svgs.scryfall.io/card-symbols/' + encodeURIComponent(name), { headers: { 'User-Agent': 'ProxyPress/1.0' }, signal:AbortSignal.timeout(30000), redirect:'error' });
      if (!upstream.ok) {
        res.writeHead(upstream.status);
        return res.end('Not found');
      }
      const svg = (await readUpstream(upstream, 256 * 1024)).toString('utf8');
      if (!svg.includes('<svg')) {
        res.writeHead(502);
        return res.end('Invalid symbol SVG');
      }
      cachePut('sym:' + name, svg);
      res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
      return res.end(req.method === 'HEAD' ? undefined : svg);
    }
  } catch (err) {
    res.writeHead(502);
    res.end('Error reaching Scryfall symbology');
  }
}

async function handleSuggestions(res, slug) {
  if (!/^[a-z0-9][a-z0-9-]{0,159}$/.test(slug)) { res.writeHead(404); return res.end('Not found'); }
  const key = 'suggest:' + slug, hit = cacheGet(key);
  if (hit) { res.writeHead(200, {'Content-Type':'application/json'}); return res.end(hit); }
  try {
    const upstream = await fetch(`https://json.edhrec.com/pages/cards/${slug}.json`, {headers:{'Accept':'application/json','User-Agent':'ProxyPress/1.0'}, signal:AbortSignal.timeout(20000), redirect:'error'});
    if (upstream.status !== 404 && !upstream.ok) throw new Error('Suggestions unavailable');
    const data = upstream.status === 404 ? {} : JSON.parse(await readUpstream(upstream, 2 * 1024 * 1024)), cards = new Map();
    const add = (name, score, kind) => { if (typeof name === 'string' && name.length && name.length <= 300 && !cards.has(name)) cards.set(name, {name, score, kind}); };
    (data.similar || []).slice(0,24).forEach((name,i) => add(name,80-i,'Similar card'));
    for (const group of data.container?.json_dict?.cardlists || []) {
      const base = {highliftcards:60,topcards:30}[group.tag];
      if (base) (group.cardviews || []).slice(0,20).forEach((card,i) => add(card.name,base-i,'Often played together'));
    }
    const result = JSON.stringify({cards:[...cards.values()].slice(0,64)}); cachePut(key,result);
    res.writeHead(200, {'Content-Type':'application/json'}); res.end(result);
  } catch {
    res.writeHead(502, {'Content-Type':'application/json'}); res.end(JSON.stringify({message:'Suggestions are unavailable right now'}));
  }
}

async function handleDeck(req, res, parsedUrl) {
  const deckUrl = (parsedUrl.searchParams?.get('u') || '').trim();
  const m = deckUrl.match(/^https?:\/\/(?:www\.)?(moxfield|archidekt)\.com\/decks\/([A-Za-z0-9_-]{1,40})(?:[/?#]|$)/);
  if (!m) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ message: 'Paste a Moxfield or Archidekt deck link' }));
  }
  const [, site, deckId] = m;
  const apiUrl = site === 'moxfield'
    ? `https://api2.moxfield.com/v2/decks/all/${deckId}`
    : `https://archidekt.com/api/decks/${deckId}/`;

  try {
    const upstream = await fetch(apiUrl, { headers: { 'User-Agent': 'ProxyPress/1.0', 'Accept': 'application/json' }, signal:AbortSignal.timeout(30000), redirect:'error' });
    if (!upstream.ok) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ message: `Could not load deck from ${site}` }));
    }
    const j = JSON.parse(await readUpstream(upstream));
    const lines = [], rows = [];
    const fmt = (q, n, st, cn) => `${q} ${n}` + (st && cn ? ` (${st.toUpperCase()}) ${cn}` : '');

    const add = (q,n,st,cn,section) => { if (typeof n !== 'string' || !n.trim()) return; const sourceLine = fmt(q,n,st,cn); lines.push(sourceLine); rows.push({sourceLine,section}); };
    if (site === 'moxfield') {
      for (const board of ['commanders', 'companions', 'signatureSpells', 'mainboard', 'sideboard', 'attractions', 'stickers', 'contraptions']) {
        for (const v of Object.values(j[board] || {})) {
          const c = v.card || {};
          add(v.quantity || 1, c.name || '', c.set || '', c.cn || '', board);
        }
      }
    } else {
      const skip = new Set((j.categories || []).filter(c => !c.includedInDeck && c.name !== 'Sideboard').map(c => c.name));
      for (const c of j.cards || []) {
        if ((c.categories || []).some(name => skip.has(name))) continue;
        const cd = c.card || {}, ed = cd.edition || {};
        add(c.quantity || 1, cd.oracleCard?.name || cd.name || '', ed.editioncode || '', cd.collectorNumber || '', (c.categories || []).filter(name=>typeof name === 'string').join(', '));
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ name:j.name || '', text:lines.join('\n'), version:2, rows }));
  } catch (err) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: `Failed to fetch from ${site}` }));
  }
}

function startServer(port = 0) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const parsed = new URL(req.url, 'http://127.0.0.1');
      const reqPath = parsed.pathname;
      const isRead = req.method === 'GET' || req.method === 'HEAD';

      if (isRead && (reqPath === '/' || reqPath === '/proxy-press.html')) {
        try {
          const html = fs.readFileSync(htmlFile, 'utf8');
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Security-Policy': pageCsp(html)
          });
          return res.end(req.method === 'HEAD' ? undefined : html);
        } catch (e) {
          res.writeHead(500);
          return res.end('Error loading proxy-press.html: ' + e.message);
        }
      }

      if (isRead && reqPath === '/og.png') {
        if (fs.existsSync(ogImage)) {
          res.writeHead(200, { 'Content-Type': 'image/png' });
          return res.end(req.method === 'HEAD' ? undefined : fs.readFileSync(ogImage));
        }
        res.writeHead(404);
        return res.end('Not found');
      }

      if (isRead && reqPath === '/assets/manifest.json') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(req.method === 'HEAD' ? undefined : JSON.stringify(assetManifest()));
      }

      if (isRead && reqPath.startsWith('/assets/')) {
        const found = safeAssetPath(reqPath);
        if (!found) {
          res.writeHead(404);
          return res.end('Asset not found');
        }
        res.writeHead(200, { 'Content-Type': found.ctype, 'Cache-Control': 'public, max-age=86400' });
        return res.end(req.method === 'HEAD' ? undefined : fs.readFileSync(found.full));
      }

      if (isRead && reqPath.startsWith('/sym/')) {
        if (!/^(index\.json|[A-Z0-9]{1,12}\.svg)$/.test(reqPath.slice(5))) {
          res.writeHead(404); return res.end('Not found');
        }
        return handleSym(req, res, reqPath);
      }

      if (isRead && reqPath === '/deck') {
        return handleDeck(req, res, parsed);
      }
      if (isRead && reqPath.startsWith('/suggest/')) return handleSuggestions(res, reqPath.slice(9));

      if (isRead && reqPath === '/healthz') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        return res.end(req.method === 'HEAD' ? undefined : 'ok');
      }

      if (reqPath.startsWith('/sf/') || reqPath.startsWith('/mpc/')) {
        if (!['GET', 'HEAD', 'POST'].includes(req.method)) { res.writeHead(405); return res.end('Method not allowed'); }
        const sfRoute = reqPath.slice(3);
        const allowed = reqPath.startsWith('/mpc/') ? MPC_PATHS.has(reqPath.slice(5)) : req.method === 'POST'
          ? sfRoute === '/cards/collection' : /^\/cards\/(named|search|autocomplete|[0-9a-f-]{36})$|^\/symbology$/.test(sfRoute);
        if (!allowed) { res.writeHead(404); return res.end('Endpoint not relayed'); }
        const route = reqPath + parsed.search;
        if (isRead) {
          return reqPath.startsWith('/sf/') ? handleSf(req, res, 'GET', route) : handleMpc(req, res, 'GET', route);
        }
        const chunks = []; let size = 0; let aborted = false;
        req.on('error', () => { aborted = true; });
        req.on('data', c => {
          if (aborted) return;
          size += c.length;
          if (size > MAX_BODY) {
            aborted = true;
            if (!res.writableEnded) { res.writeHead(413, { 'Connection': 'close' }); res.end('Request body too large'); }
            if (typeof req.destroy === 'function') req.destroy();
            return;
          }
          chunks.push(c);
        });
        req.on('end', async () => {
          if (aborted || size > MAX_BODY) return;
          const body = Buffer.concat(chunks);
          if (reqPath.startsWith('/sf/')) {
            await handleSf(req, res, req.method, route, body);
          } else {
            await handleMpc(req, res, req.method, route, body);
          }
        });
        return;
      }

      res.writeHead(404);
      res.end('Not found');
    });

    server.listen(port, '127.0.0.1', () => {
      resolve({ server, port: server.address().port });
    });
    server.on('error', reject);
  });
}

if (app) {
  let mainWindow = null;
  let srv = null;

  app.whenReady().then(async () => {
    if (process.platform === 'win32') {
      app.setAppUserModelId('io.github.zoro11031.proxypress');
    }
    srv = await startServer(8642).catch(() => startServer(0));

    const rendererOrigin = 'http://127.0.0.1:8642';
    protocol.handle('http', request => {
      const target = new URL(request.url);
      if (target.origin !== rendererOrigin) return net.fetch(request, {bypassCustomProtocolHandlers:true});
      const internal = new URL(target.pathname + target.search, `http://127.0.0.1:${srv.port}`);
      const body = ['GET','HEAD'].includes(request.method) ? undefined : request.body;
      return net.fetch(internal.href, {method:request.method,headers:request.headers,body,duplex:'half',bypassCustomProtocolHandlers:true});
    });

    const iconPath = process.platform === 'win32'
      ? path.join(__dirname, 'icon.ico')
      : path.join(__dirname, 'icon.png');

    mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 960,
      minHeight: 640,
      title: 'Proxy Press',
      backgroundColor: '#121a24',
      darkTheme: true,
      show: false,
      icon: fs.existsSync(iconPath) ? iconPath : undefined,
      autoHideMenuBar: true,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });

    mainWindow.once('ready-to-show', () => {
      mainWindow.show();
    });

    configureNavigation(mainWindow, rendererOrigin);

    const isMac = process.platform === 'darwin';
    const menuTemplate = [
      ...(isMac ? [{
        label: app.name,
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' }
        ]
      }] : []),
      {
        label: 'File',
        submenu: [
          isMac ? { role: 'close' } : { role: 'quit' }
        ]
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' }
        ]
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' }
        ]
      },
      {
        label: 'Help',
        submenu: [
          {
            label: 'GitHub Repository',
            click: () => shell.openExternal('https://github.com/zoro11031/proxypress')
          },
          {
            label: 'Art search website',
            click: () => shell.openExternal('https://mpcfill.com')
          },
          {
            label: 'Support the autofill tool (Patreon)',
            click: () => shell.openExternal('https://www.patreon.com/mpcfill')
          },
          {
            label: 'Scryfall',
            click: () => shell.openExternal('https://scryfall.com')
          }
        ]
      }
    ];

    Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));
    mainWindow.loadURL(rendererOrigin + '/?desktop=1');

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = new BrowserWindow({
          width: 1400,
          height: 900,
          minWidth: 960,
          minHeight: 640,
          title: 'Proxy Press',
          backgroundColor: '#121a24',
          darkTheme: true,
          show: false,
          icon: fs.existsSync(iconPath) ? iconPath : undefined,
          autoHideMenuBar: true,
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
          }
        });
        mainWindow.once('ready-to-show', () => mainWindow.show());
        configureNavigation(mainWindow, rendererOrigin);
        mainWindow.loadURL(rendererOrigin + '/?desktop=1');
      }
    });
  });

  app.on('before-quit', () => {
    if (srv?.server) {
      try { srv.server.close(); } catch {}
      srv = null;
    }
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

module.exports = { startServer, assetManifest };
