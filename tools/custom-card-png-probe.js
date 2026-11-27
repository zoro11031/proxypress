// Regression probe for exporting custom created cards as PNGs.
(async () => {
  const fails = [];
  const check = (name, ok, detail = '') => { if (!ok) fails.push(detail ? `${name}: ${detail}` : name); };
  const origDownload = download;
  const origDecks = structuredClone(S.decks);
  const origDeckId = S.deckId;
  const downloads = [];
  download = (blob, name) => downloads.push({blob, name, size: blob.size, type: blob.type});
  try {
    const c0 = document.createElement('canvas');
    c0.width = 400; c0.height = 300;
    const g0 = c0.getContext('2d');
    g0.fillStyle = '#336699';
    g0.fillRect(0, 0, 400, 300);
    const artBlob = await new Promise(r => c0.toBlob(r, 'image/png'));
    const artKey = await storeImage(artBlob);

    // 1. Open Card Maker with no art: Export PNG must be disabled.
    await openCardMaker({});
    check('Export PNG disabled without art', $('#ccExportPng').disabled === true);
    check('Bleed checkbox checked by default', $('#ccPngBleed').checked === true);
    closeModal(true);

    // 2. Add a custom-created card and verify deck menu, context menu, and maker PNG export.
    const d = deck();
    const e1 = {
      uid: uid(), qty: 1, name: 'Test Pony', custom: true,
      faces: [{
        name: 'Test Pony', custom: artKey, srcBleed: MPC_BLEED,
        template: {name: 'Test Pony', mana: '{1}{U}', type: 'Creature — Pony', text: 'Flying', pt: '2/2', artKey, style: 'modern', color: 'auto', zoom: 1, ox: 0, oy: 0}
      }],
      tokens: []
    };
    d.entries.push(e1);
    renderAll();

    check('deck menu shows single custom card export', !$('#btnExportCustomPngs').hidden && $('#btnExportCustomPngs').textContent === 'Export custom card (PNG)', $('#btnExportCustomPngs').textContent);

    // Context menu shows Export PNG for custom card.
    openCtx(100, 100, e1, 0);
    const ctxBtn = document.querySelector('#ctx [data-c="exportpng"]');
    check('ctx menu shows Export PNG for custom card', Boolean(ctxBtn));
    ctxBtn.click();
    await sleep(200);
    check('ctx Export PNG downloaded Test Pony.png', downloads.length === 1 && downloads[0].name === 'Test Pony.png' && downloads[0].type === 'image/png', JSON.stringify(downloads.map(x => ({name: x.name, type: x.type, size: x.size}))));

    // Open Card Maker on e1, export WITH bleed and WITHOUT bleed.
    await openCardMaker({e: e1, i: 0});
    check('Export PNG enabled when art exists', $('#ccExportPng').disabled === false);
    downloads.length = 0;
    $('#ccExportPng').click();
    await sleep(400);
    check('maker Export PNG with bleed downloaded', downloads.length === 1 && downloads[0].name === 'Test Pony.png' && downloads[0].type === 'image/png');
    const bmpBleed = await createImageBitmap(downloads[0].blob);

    $('#ccPngBleed').checked = false;
    downloads.length = 0;
    $('#ccExportPng').click();
    await sleep(400);
    check('maker Export PNG trimmed downloaded', downloads.length === 1 && downloads[0].name === 'Test Pony.png' && downloads[0].type === 'image/png');
    const bmpTrim = await createImageBitmap(downloads[0].blob);
    check('with-bleed PNG is larger than trimmed PNG', bmpBleed.width > bmpTrim.width && bmpBleed.height > bmpTrim.height, `${bmpBleed.width}x${bmpBleed.height} vs ${bmpTrim.width}x${bmpTrim.height}`);
    check('trimmed PNG matches 63x88mm at 600 DPI', Math.abs(bmpTrim.width - 1488) <= 2 && Math.abs(bmpTrim.height - 2079) <= 2, `${bmpTrim.width}x${bmpTrim.height}`);
    bmpBleed.close();
    bmpTrim.close();

    // 3. Add a 2nd custom card with the same name and verify bulk zip export deduplication.
    const e2 = {
      uid: uid(), qty: 1, name: 'Test Pony', custom: true,
      faces: [{name: 'Test Pony', custom: artKey, srcBleed: MPC_BLEED, template: {...e1.faces[0].template}}],
      tokens: []
    };
    d.entries.push(e2);
    renderAll();
    check('deck menu shows zip export for 2 custom cards', !$('#btnExportCustomPngs').hidden && $('#btnExportCustomPngs').textContent === 'Export 2 custom cards (PNG zip)', $('#btnExportCustomPngs').textContent);
    downloads.length = 0;
    await exportDeckCustomPngs();
    check('bulk export downloads zip', downloads.length === 1 && downloads[0].name.endsWith('- custom cards.zip') && downloads[0].type === 'application/zip' && downloads[0].size > 1000, JSON.stringify(downloads.map(x => ({name: x.name, type: x.type, size: x.size}))));
    const zipText = new TextDecoder('latin1').decode(await downloads[0].blob.arrayBuffer());
    check('zip contains deduplicated PNG filenames', zipText.includes('Test Pony.png') && zipText.includes('Test Pony (2).png'));
  } catch (err) {
    fails.push('threw: ' + (err.stack || err));
  } finally {
    download = origDownload;
    S.decks = origDecks;
    S.deckId = origDeckId;
    if (!window.__keepMakerOpen) closeModal(true);
    renderAll();
  }
  return fails.length ? {fails} : true;
})();
