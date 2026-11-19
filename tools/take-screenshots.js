#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const fixturesDir = path.join(root, 'out/screenshots-fixtures');
const cardsPath = path.join(fixturesDir, 'cards.json');
const mpcLotusPath = path.join(fixturesDir, 'mpc-lotus.json');

const target = process.argv[2] || 'all';

async function ensureFixtures() {
  if (fs.existsSync(cardsPath) && fs.existsSync(mpcLotusPath)) {
    return {
      cards: JSON.parse(fs.readFileSync(cardsPath, 'utf8')),
      mpcLotus: JSON.parse(fs.readFileSync(mpcLotusPath, 'utf8'))
    };
  }
  fs.mkdirSync(fixturesDir, { recursive: true });
  const cardDefs = [
    {name: 'Black Lotus', q: 'set:vma cn:4'},
    {name: 'Mox Diamond', q: 'set:tpr cn:228'},
    {name: 'Sol Ring', q: 'set:trc cn:499'},
    {name: 'Demonic Tutor', q: 'set:cmm cn:150'},
    {name: 'Rhystic Study', q: 'set:j22 cn:114'},
    {name: 'Force of Will', q: 'set:dmr cn:50'},
    {name: 'Lightning Bolt', q: 'set:sld cn:85'},
    {name: 'Swords to Plowshares', q: 'set:sta cn:73 lang:ja'}
  ];
  const headers = {'User-Agent': 'Mozilla/5.0 ProxyPress/1.0', 'Accept': '*/*'};
  const cards = [];
  for (const c of cardDefs) {
    const res = await fetch('https://api.scryfall.com/cards/search?q=' + encodeURIComponent(c.q), { headers });
    const d = await res.json();
    const card = d.data[0];
    const imgUrl = (card.image_uris || card.card_faces[0].image_uris).normal;
    const imgRes = await fetch(imgUrl, { headers });
    const buf = Buffer.from(await imgRes.arrayBuffer());
    cards.push({
      name: c.name, set: card.set.toUpperCase(), cn: '#' + card.collector_number, scryId: card.id,
      b64: 'data:image/jpeg;base64,' + buf.toString('base64')
    });
    await new Promise(r => setTimeout(r, 100));
  }
  fs.writeFileSync(cardsPath, JSON.stringify(cards));

  const jsonHeaders = {'User-Agent': 'Mozilla/5.0 ProxyPress/1.0', 'Content-Type': 'application/json'};
  const srcRes = await fetch('https://mpcfill.com/2/sources/', { headers: jsonHeaders });
  const sources = await srcRes.json();
  const searchRes = await (await fetch('https://mpcfill.com/2/editorSearch/', {
    method: 'POST', headers: jsonHeaders,
    body: JSON.stringify({
      searchSettings: {
        searchTypeSettings: {fuzzySearch: false, filterCardbacks: false},
        sourceSettings: {sources: Object.values(sources.results || {}).map(x => [x.pk, true])},
        filterSettings: {minimumDPI: 0, maximumDPI: 1500, maximumSize: 30, languages: [], includesTags: [], excludesTags: ['NSFW']}
      },
      queries: [{query: 'black lotus', cardType: 'CARD'}]
    })
  })).json();
  const topIds = (searchRes.results?.['black lotus']?.CARD || []).slice(0, 24);
  const cardDetailsRes = await (await fetch('https://mpcfill.com/2/cards/', {
    method: 'POST', headers: jsonHeaders,
    body: JSON.stringify({cardIdentifiers: topIds})
  })).json();
  const mpcLotus = { sources, search: searchRes, cards: cardDetailsRes };
  fs.writeFileSync(mpcLotusPath, JSON.stringify(mpcLotus));
  return { cards, mpcLotus };
}

function createProbe(state, cards, mpcLotus) {
  return `(async () => {
    S.welcomed = true;
    closeModal(true);

    const upscale = async dataUrl => {
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; });
      const c = document.createElement('canvas');
      c.width = 800; c.height = 1116;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, 800, 1116);
      return new Promise(res => c.toBlob(res, 'image/jpeg', 0.95));
    };

    const cards = ${JSON.stringify(cards)};
    const entries = [];
    for (const c of cards) {
      const blob = await upscale(c.b64);
      const key = await storeImage(blob);
      entries.push({
        uid: uid(),
        name: c.name,
        set: c.set,
        cn: c.cn,
        scryId: c.scryId,
        qty: 1,
        kind: 'CARD',
        faces: [{
          name: c.name,
          custom: key,
          normal: c.b64,
          mpcDpi: 320
        }]
      });
    }

    deck().name = 'Commander Staples';
    deck().entries = entries;
    deck().calibrationState = {
      front: { offsetX: 0, offsetY: 0, scaleX: 100, scaleY: 100, rotate: 0, status: 'Applied', source: 'Default' },
      back: { offsetX: 0, offsetY: 0, scaleX: 100, scaleY: 100, rotate: 0, status: 'Applied', source: 'Default' }
    };
    S.mode = 'print';
    S.settings = cleanSettings({
      ...DEFAULTS,
      pageSize: 'letter',
      orientation: 'landscape',
      cols: 4,
      rows: 2,
      margin: 5,
      bleed: 1.5,
      guides: 'both',
      backs: false,
      silhouette: false
    });
    S.showBacks = false;
    S.proofSide = 'front';
    setShowCuts(true);
    S.zoomMode = 'fit';

    if ('${state}' === 'print-preview') {
      renderAll();
      $('#zoomFit')?.click();
      await drawPreview();
      await sleep(1500);
      return true;
    }

    if ('${state}' === 'art-picker') {
      const mpcData = ${JSON.stringify(mpcLotus)};
      mpcSources = mpcData.sources.results;
      const originalMpcApi = window.mpcApi;
      window.mpcApi = async (endpoint, body) => {
        if (endpoint === '2/sources/') return mpcData.sources;
        if (endpoint === '2/editorSearch/') return mpcData.search;
        if (endpoint === '2/cards/') return mpcData.cards;
        return originalMpcApi(endpoint, body);
      };

      renderAll();
      await drawPreview();
      await sleep(400);

      const targetEntry = deck().entries[0];
      await openMpcPicker({ e: targetEntry, i: 0, copies: [{ uid: targetEntry.uid, copies: [0] }] });
      await sleep(1000);

      // Switch to Community art tab
      const commTab = document.querySelector('[data-src-tab="community"]');
      if (commTab) commTab.click();
      await sleep(1500);

      // Select first community art card for candidate comparison
      const firstFig = document.querySelector('#communityArt figure');
      if (firstFig) {
        firstFig.click();
        await sleep(500);
        const dpiEl = document.getElementById('cmpCandidateDpi');
        if (dpiEl) dpiEl.innerHTML = '<b style="color:var(--ok)">800 DPI</b>';
      }
      await sleep(500);
      return true;
    }

    if ('${state}' === 'cutting-workflow') {
      applyCameoLayout('Silhouette Cameo layout ready');
      renderAll();
      openPrintSettings('cutting');
      const drawer = document.getElementById('cameoAdvDrawer');
      if (drawer) drawer.open = true;
      await sleep(1000);
      return true;
    }

    if ('${state}' === 'order-mode') {
      S.mode = 'order';
      applyMode();
      renderAll();
      setWorkspaceView('proof');
      await drawPreview();
      await sleep(1500);
      return true;
    }

    return false;
  })();`;
}

function capture(state, outFilename, cards, mpcLotus) {
  console.log(`\nCapturing ${state} -> ${outFilename}...`);
  const probeContent = createProbe(state, cards, mpcLotus);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-shot-'));
  const probeFile = path.join(tempDir, 'probe.js');
  fs.writeFileSync(probeFile, probeContent);

  const outPath = path.resolve(root, outFilename);
  const res = spawnSync(process.execPath, [
    path.join(__dirname, 'console-check.js'),
    '--probe', probeFile,
    '--width', '1600',
    '--height', '1000',
    '--scale', '1',
    '--screenshot', outPath,
    '--deadline', '60'
  ], { cwd: root, stdio: 'inherit' });

  fs.rmSync(tempDir, { recursive: true, force: true });
  if (res.status !== 0) {
    console.error(`Failed capturing ${state}`);
    process.exitCode = res.status ?? 1;
  } else {
    console.log(`Saved ${outFilename}`);
  }
}

(async () => {
  const { cards, mpcLotus } = await ensureFixtures();
  const states = [
    ['print-preview', 'screenshots/print-preview.png'],
    ['art-picker', 'screenshots/art-picker.png'],
    ['cutting-workflow', 'screenshots/cutting-workflow.png'],
    ['order-mode', 'screenshots/order-mode.png']
  ];

  for (const [state, out] of states) {
    if (target === 'all' || target === state) {
      capture(state, out, cards, mpcLotus);
    }
  }
})().catch(err => {
  console.error(err);
  process.exit(1);
});
