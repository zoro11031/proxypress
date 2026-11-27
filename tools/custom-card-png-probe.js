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
    const bleedBlob = downloads.length ? null : null; // captured below
    bmpBleed.close();
    bmpTrim.close();

    // 2b. Re-importing an exported custom card PNG (with bleed) via #fileFace, uploadImages, and uploadSharedCardback
    //     MUST preserve MPC_BLEED so Silhouette (SCM) does not shrink the artwork or inflate the bleed!
    closeModal(true);
    const renderedCardCanvas = await renderCustomCard({...e1.faces[0].template}, await loadImage(await customUrl(artKey)), 600 / 25.4);
    const exportedBleedBlob = await customCardCanvasToPngBlob(renderedCardCanvas, true);
    const exportedTrimBlob = await customCardCanvasToPngBlob(renderedCardCanvas, false);
    const origFaceKey = await storeImage(exportedBleedBlob);
    const origCustomFace = {name: 'Test Pony', custom: origFaceKey, srcBleed: MPC_BLEED};

    // Simulate #fileFace upload (replacing art on an existing card with the exported bleed PNG).
    const eTarget = {uid: uid(), qty: 1, name: 'Demonic Tutor', custom: true, faces: [{name: 'Demonic Tutor', custom: artKey, srcBleed: 0}], tokens: []};
    d.entries.push(eTarget);
    const dtBleed = new DataTransfer();
    dtBleed.items.add(new File([exportedBleedBlob], 'Test Pony.png', {type: 'image/png'}));
    faceTarget = {e: eTarget, i: 0};
    $('#fileFace').files = dtBleed.files;
    $('#fileFace').dispatchEvent(new Event('change', {bubbles: true}));
    await sleep(300);
    closeModal(true);
    check('#fileFace detects MPC_BLEED on re-imported custom PNG', Math.abs((eTarget.faces[0].srcBleed ?? -1) - MPC_BLEED) < 0.01, `got ${eTarget.faces[0].srcBleed}`);

    // Verify rendered pixels under Silhouette letter-standard-v6 match the original custom card (zero shrinkage!).
    const scmSet = {...DEFAULTS, silhouette: true, pageSize: 'letter', cardPreset: 'mtg', orientation: 'landscape', scmTemplate: 'standard'};
    const cOrig = await renderFace(origCustomFace, 150, true, 0, scmSet, false);
    const cReimp = await renderFace(eTarget.faces[0], 150, true, 0, scmSet, false);
    const pxOrig = cOrig.getContext('2d').getImageData(0, 0, cOrig.width, cOrig.height).data;
    const pxReimp = cReimp.getContext('2d').getImageData(0, 0, cReimp.width, cReimp.height).data;
    let maxDiff = 0;
    for (let k = 0; k < pxOrig.length; k += 16) maxDiff = Math.max(maxDiff, Math.abs(pxOrig[k] - pxReimp[k]));
    check('re-imported bleed PNG renders pixel-identically under Silhouette (no art shrink)', maxDiff <= 2, `maxDiff=${maxDiff}`);

    // Verify #fileFace sets srcBleed=0 on a trimmed (no-bleed) exported PNG.
    const dtTrim = new DataTransfer();
    dtTrim.items.add(new File([exportedTrimBlob], 'Test Pony trimmed.png', {type: 'image/png'}));
    faceTarget = {e: eTarget, i: 0};
    $('#fileFace').files = dtTrim.files;
    $('#fileFace').dispatchEvent(new Event('change', {bubbles: true}));
    await sleep(300);
    closeModal(true);
    check('#fileFace sets srcBleed=0 on trimmed exported PNG', eTarget.faces[0].srcBleed === 0, `got ${eTarget.faces[0].srcBleed}`);

    // Verify uploadSharedCardback also preserves MPC_BLEED under Silhouette.
    const origBackImg = S.settings.backImage, origBackBleed = S.settings.backImageBleed;
    await uploadSharedCardback(new File([exportedBleedBlob], 'Custom Back.png', {type: 'image/png'}));
    check('uploadSharedCardback detects MPC_BLEED on bleed PNG', Math.abs((S.settings.backImageBleed ?? -1) - MPC_BLEED) < 0.01, `got ${S.settings.backImageBleed}`);
    const backSlot = buildSlots(d, {...scmSet, backs: true, backImage: S.settings.backImage, backImageBleed: S.settings.backImageBleed})[0];
    check('buildSlots forwards backImageBleed to shared cardback face', Math.abs((backSlot.back.srcBleed ?? -1) - MPC_BLEED) < 0.01, `got ${backSlot.back?.srcBleed}`);
    S.settings.backImage = origBackImg; S.settings.backImageBleed = origBackBleed;
    d.entries = d.entries.filter(x => x !== eTarget);

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

    // 4. Verify custom card mana symbol drop shadow wraps cleanly below the bottom of {B},
    //    appears on borderless/dark frames, and preserves aspect ratio for wide symbols like {100}.
    await loadServerAssets();
    const m15 = allSets().find(s => s.name === 'magic-m15');
    if (m15) {
      const k = 20, b = MPC_BLEED;
      const cvB = await renderCustomCard({style: 'set:' + m15.id, name: 'Demonic Tutor', mana: '{1}{B}', type: 'Sorcery', text: 'Search.', color: 'B'}, null, k);
      const ctxB = cvB.getContext('2d');
      const d = Math.min(3.4, (m15.layout.cost.h || 22) * 88 / m15.h * 0.8);
      const right = m15.layout.cost.right * 63 / m15.w;
      const cy = ((m15.layout.cost.top || 0) + (m15.layout.cost.h || 22) / 2) * 88 / m15.h;
      const bCx = right - d / 2, bTop = cy - d / 2 - d * 0.04;
      const sample = (cv) => {
        const data = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
        return (xMm, yMm) => {
          const i = (Math.round((b + yMm) * k) * cv.width + Math.round((b + xMm) * k)) * 4;
          return (data[i] + data[i + 1] + data[i + 2]) / 3;
        };
      };
      const pxB = sample(cvB);
      // Directly under bottom center of {B} (+0.045*d below circle bottom) and around bottom-right
      // (+0.28*d right, where circle ends at +0.914*d and shadow extends to +0.979*d) must be dark shadow;
      // far left of {B} (-0.06*d past left edge) must be clear title bar, not overgrown left shadow.
      const shBottom = pxB(bCx, bTop + d + d * 0.045);
      const shBottomRight = pxB(bCx + d * 0.28, bTop + d * 0.945);
      const farLeft = pxB(right - d - d * 0.06, bTop + d / 2);
      check('{B} mana shadow sits cleanly below bottom center', shBottom < 40, `lum=${shBottom.toFixed(1)}`);
      check('{B} mana shadow wraps around bottom-right', shBottomRight < 40, `lum=${shBottomRight.toFixed(1)}`);
      check('{B} mana shadow does not bulge far left into neighbor', farLeft > 140, `lum=${farLeft.toFixed(1)}`);

      // Borderless M15 should also draw the drop shadow (not disable it via !light).
      const cvDark = await renderCustomCard({style: 'set:' + m15.id, artMode: 'borderless', name: 'Demonic Tutor', mana: '{1}{B}', type: 'Sorcery', text: 'Search.', color: 'B'}, null, k);
      const shDarkBottom = sample(cvDark)(bCx, bTop + d + d * 0.045);
      check('borderless {B} keeps black drop shadow below bottom', shDarkBottom < 20, `lum=${shDarkBottom.toFixed(1)}`);
    }

    // 5. Verify overhauled Card Maker workbench interactions.
    await openCardMaker({});
    check('Card Maker opens on Art & Frame tab', $('[data-cc-tab="art"]').classList.contains('on') && !$('[data-cc-pane="art"]').hidden && $('[data-cc-pane="text"]').hidden);
    // Guides toggle hides/shows legend cleanly.
    check('Print guides start enabled', $('#ccShowGuides').classList.contains('on') && !$('#ccLegend').hidden);
    $('#ccShowGuides').click();
    check('Print guides toggle hides legend', !$('#ccShowGuides').classList.contains('on') && $('#ccLegend').hidden);
    // Color swatch syncs #ccColor.
    $('[data-cc-color="U"]').click();
    check('Color swatch updates #ccColor', $('#ccColor').value === 'U' && $('[data-cc-color="U"]').classList.contains('on'));
    // Art mode pill syncs #ccArtMode.
    $('[data-cc-mode="borderless"]').click();
    check('Art mode pill updates #ccArtMode', $('#ccArtMode').value === 'borderless' && $('[data-cc-mode="borderless"]').classList.contains('on'));
    // Stage zoom controls update #ccZoom and readout.
    $('#ccZoomIn').click();
    check('Stage zoom-in updates zoom and readout', +$('#ccZoom').value > 1.1 && $('#ccStageZoomVal').textContent === $('#ccZoomVal').textContent, $('#ccStageZoomVal').textContent);
    $('#ccStageReset').click();
    check('Stage Fit resets zoom to 100%', $('#ccZoom').value === '1' && $('#ccStageZoomVal').textContent === '100%');
    // Switch to Card Text tab, test live header title, mana bump/clear, and rules symbol insert.
    $('[data-cc-tab="text"]').click();
    check('Card Text tab reveals text pane', !$('[data-cc-pane="text"]').hidden && $('[data-cc-pane="art"]').hidden);
    $('#cc-name').value = 'Demonic Tutor';
    $('#cc-name').dispatchEvent(new Event('input', {bubbles: true}));
    check('Modal header title updates live with card name', $('#modal .hd b').textContent.includes('Demonic Tutor'), $('#modal .hd b').textContent);
    $('[data-mana-bump="N"]').click();
    $('[data-mana-bump="B"]').click();
    check('Mana icon clicks bump counts and reveal Clear', $('[data-mana="N"]').value === '1' && $('[data-mana="B"]').value === '1' && !$('#ccManaClear').hidden);
    $('#ccManaClear').click();
    check('Mana Clear resets counts', $('[data-mana="N"]').value === '' && $('[data-mana="B"]').value === '' && $('#ccManaClear').hidden);
    $('#cc-text').value = 'Add ';
    $('#cc-text').setSelectionRange(4, 4);
    $('#ccSymBar [data-ins="{B}"]').click();
    check('Rules symbol bar inserts token at cursor', $('#cc-text').value === 'Add {B}', $('#cc-text').value);
    // Switch to Extras tab and test stamp pills.
    $('[data-cc-tab="extras"]').click();
    check('Extras tab reveals extras pane', !$('[data-cc-pane="extras"]').hidden);
    $('[data-cc-stamp="oval"]').click();
    check('Stamp pill updates stamp and activates Extras dot', $('[data-cc="stamp"]').value === 'oval' && !$('#ccDotExtras').hidden);
    closeModal(true);
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
