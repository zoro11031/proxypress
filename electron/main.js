// SPDX-License-Identifier: GPL-3.0-or-later
let app, BrowserWindow, shell, Menu;
try {
  ({ app, BrowserWindow, shell, Menu } = require('electron'));
} catch {}
const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const url = require('node:url');

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
  'style': 'text/plain'
};

function pageCsp(htmlContent) {
  const hashes = [...htmlContent.matchAll(/<script>(.*?)<\/script>/gs)]
    .map(m => `'sha256-${crypto.createHash('sha256').update(m[1]).digest('base64')}'`)
    .join(' ');
  return [
    "default-src 'self'",
    `script-src 'self' ${hashes} https://cdnjs.cloudflare.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
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
      if (fs.statSync(d).isDirectory() && fs.existsSync(path.join(d, 'style'))) {
        const files = fs.readdirSync(d).filter(f => fs.statSync(path.join(d, f)).isFile()).sort();
        frames.push({ name, files });
      }
    }
    frames.sort((a, b) => a.name.localeCompare(b.name));
  }
  return { fonts, frames };
}

function safeAssetPath(reqRoute) {
  const rel = decodeURIComponent(reqRoute.slice('/assets/'.length));
  const full = path.resolve(path.join(assetsDir, rel));
  if (!full.startsWith(path.resolve(assetsDir) + path.sep) || !fs.existsSync(full) || !fs.statSync(full).isFile()) {
    return null;
  }
  const ext = path.extname(full).toLowerCase();
  const ctype = ASSET_TYPES[ext] || (path.basename(full) === 'style' ? 'text/plain' : null);
  return ctype ? { full, ctype } : null;
}

function cacheKey(key) {
  return path.join(cacheDir, crypto.createHash('sha256').update(key).digest('hex') + '.json');
}

function cacheGet(key) {
  try {
    const f = cacheKey(key);
    if (fs.existsSync(f)) {
      const [ts, data] = JSON.parse(fs.readFileSync(f, 'utf8'));
      return data;
    }
  } catch {}
  return null;
}

function cachePut(key, data) {
  try {
    const f = cacheKey(key);
    fs.writeFileSync(f, JSON.stringify([Date.now() / 1000, data]), 'utf8');
  } catch {}
}

async function handleMpc(req, res, method, reqPath, body) {
  const targetUrl = 'https://mpcfill.com' + reqPath.slice('/mpc'.length);
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
      body: body && body.length ? body : undefined
    });
    const data = await upstream.arrayBuffer();
    res.writeHead(upstream.status, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(Buffer.from(data));
  } catch (err) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ name: 'Relay error', message: 'Could not reach mpcfill.com' }));
  }
}

async function handleSf(req, res, method, reqPath, body) {
  const targetUrl = 'https://api.scryfall.com' + reqPath.slice('/sf'.length);
  const cacheHit = method === 'GET' ? cacheGet('sf:' + targetUrl) : null;
  if (cacheHit) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(cacheHit);
  }
  try {
    const headers = {
      'User-Agent': 'ProxyPress/1.0',
      'Accept': 'application/json'
    };
    if (body) headers['Content-Type'] = 'application/json';

    const upstream = await fetch(targetUrl, {
      method,
      headers,
      body: body && body.length ? body : undefined
    });
    const text = await upstream.text();
    if (method === 'GET' && upstream.status === 200) {
      cachePut('sf:' + targetUrl, text);
    }
    res.writeHead(upstream.status, { 'Content-Type': 'application/json' });
    res.end(text);
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
      const upstream = await fetch('https://api.scryfall.com/symbology', { headers: { 'User-Agent': 'ProxyPress/1.0' } });
      const data = await upstream.json();
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
      const upstream = await fetch('https://svgs.scryfall.io/card-symbols/' + encodeURIComponent(name), { headers: { 'User-Agent': 'ProxyPress/1.0' } });
      if (!upstream.ok) {
        res.writeHead(upstream.status);
        return res.end('Not found');
      }
      const svg = await upstream.text();
      cachePut('sym:' + name, svg);
      res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
      return res.end(svg);
    }
  } catch (err) {
    res.writeHead(502);
    res.end('Error reaching Scryfall symbology');
  }
}

async function handleDeck(req, res, parsedUrl) {
  const deckUrl = (parsedUrl.searchParams?.get('u') || '').trim();
  const m = deckUrl.match(/https?:\/\/(?:www\.)?(moxfield|archidekt)\.com\/decks\/([A-Za-z0-9_-]+)/);
  if (!m) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ message: 'Paste a Moxfield or Archidekt deck link' }));
  }
  const [, site, deckId] = m;
  const apiUrl = site === 'moxfield'
    ? `https://api2.moxfield.com/v2/decks/all/${deckId}`
    : `https://archidekt.com/api/decks/${deckId}/`;

  try {
    const upstream = await fetch(apiUrl, { headers: { 'User-Agent': 'ProxyPress/1.0', 'Accept': 'application/json' } });
    if (!upstream.ok) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ message: `Could not load deck from ${site}` }));
    }
    const j = await upstream.json();
    const lines = [];
    const fmt = (q, n, st, cn) => `${q} ${n}` + (st && cn ? ` (${st.toUpperCase()}) ${cn}` : '');

    if (site === 'moxfield') {
      for (const board of ['commanders', 'companions', 'mainboard', 'sideboard']) {
        for (const v of Object.values(j[board] || {})) {
          const c = v.card || {};
          lines.push(fmt(v.quantity || 1, c.name || '', c.set || '', c.cn || ''));
        }
      }
    } else {
      for (const c of j.cards || []) {
        const cd = c.card || {}, ed = cd.edition || {};
        lines.push(fmt(c.quantity || 1, cd.oracleCard?.name || cd.name || '', ed.editioncode || '', cd.collectorNumber || ''));
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ text: lines.join('\n') }));
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

      if (req.method === 'GET' && (reqPath === '/' || reqPath === '/proxy-press.html')) {
        try {
          const html = fs.readFileSync(htmlFile, 'utf8');
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Security-Policy': pageCsp(html)
          });
          return res.end(html);
        } catch (e) {
          res.writeHead(500);
          return res.end('Error loading proxy-press.html: ' + e.message);
        }
      }

      if (req.method === 'GET' && reqPath === '/og.png') {
        if (fs.existsSync(ogImage)) {
          res.writeHead(200, { 'Content-Type': 'image/png' });
          return res.end(fs.readFileSync(ogImage));
        }
        res.writeHead(404);
        return res.end('Not found');
      }

      if (req.method === 'GET' && reqPath === '/assets/manifest.json') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(assetManifest()));
      }

      if (req.method === 'GET' && reqPath.startsWith('/assets/')) {
        const found = safeAssetPath(reqPath);
        if (!found) {
          res.writeHead(404);
          return res.end('Asset not found');
        }
        res.writeHead(200, { 'Content-Type': found.ctype, 'Cache-Control': 'public, max-age=86400' });
        return res.end(fs.readFileSync(found.full));
      }

      if (req.method === 'GET' && reqPath.startsWith('/sym/')) {
        return handleSym(req, res, reqPath);
      }

      if (req.method === 'GET' && reqPath === '/deck') {
        return handleDeck(req, res, parsed);
      }

      if (req.method === 'GET' && reqPath === '/healthz') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        return res.end('ok');
      }

      if (reqPath.startsWith('/sf/') || reqPath.startsWith('/mpc/')) {
        const chunks = [];
        req.on('data', c => chunks.push(c));
        req.on('end', async () => {
          const body = Buffer.concat(chunks);
          if (reqPath.startsWith('/sf/')) {
            await handleSf(req, res, req.method, reqPath, body);
          } else {
            await handleMpc(req, res, req.method, reqPath, body);
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

  app.whenReady().then(async () => {
    if (process.platform === 'win32') {
      app.setAppUserModelId('io.github.zoro11031.proxypress');
    }
    let srv;
    try {
      srv = await startServer(8642).catch(() => startServer(0));
    } catch (e) {
      srv = await startServer(0);
    }

    const iconPath = process.platform === 'win32'
      ? path.join(__dirname, 'icon.ico')
      : path.join(__dirname, 'icon.png');

    mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 960,
      minHeight: 640,
      title: 'Proxy Press',
      backgroundColor: '#14161a',
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

    mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
      if (/^https?:\/\//i.test(targetUrl)) {
        shell.openExternal(targetUrl);
      }
      return { action: 'deny' };
    });

    mainWindow.webContents.on('will-navigate', (event, targetUrl) => {
      const serverHost = `127.0.0.1:${srv.port}`;
      if (!targetUrl.includes(serverHost)) {
        event.preventDefault();
        shell.openExternal(targetUrl);
      }
    });

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
            label: 'MPC Autofill Website',
            click: () => shell.openExternal('https://mpcfill.com')
          },
          {
            label: 'Donate to MPC Autofill (Patreon)',
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
    mainWindow.loadURL(`http://127.0.0.1:${srv.port}/`);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = new BrowserWindow({
          width: 1400,
          height: 900,
          minWidth: 960,
          minHeight: 640,
          title: 'Proxy Press',
          backgroundColor: '#14161a',
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
        mainWindow.loadURL(`http://127.0.0.1:${srv.port}/`);
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

module.exports = { startServer, assetManifest };
