// Probe for tools/console-check.js --probe tools/workspace-probe.js
// Tests the 3-column workspace layout, live sheet proof view toggles, card queue,
// print setup inspector, and persistent export bar against the reference redesign.
(async () => {
  const fails = [];
  const eq = (name, got, want) => {
    if (got !== want) fails.push(`${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
  };

  try {
    // 1. Verify 3-column layout structure
    const main = $('main');
    const cs = getComputedStyle(main);
    const cols = cs.gridTemplateColumns.split(/\s+/);
    eq('main has 3 columns in desktop print mode', cols.length, 3);
    eq('left queue column exists', !!$('main>aside'), true);
    eq('center proof stage exists', !!$('#stage'), true);
    eq('right inspector column exists', !!$('#workspaceInspector'), true);

    // 2. Add sample cards to deck to verify queue & proof integration
    const d = deck();
    const samplePng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    d.entries = [
      {uid: 'c1', name: 'Black Lotus', qty: 1, faces: [{name: 'Black Lotus', custom: null, scryArt: samplePng, normal: samplePng}]},
      {uid: 'c2', name: 'Mox Diamond', qty: 1, faces: [{name: 'Mox Diamond', custom: null, scryArt: samplePng, normal: samplePng}]}
    ];
    S.settings.pageSize = 'letter';
    S.settings.orientation = 'landscape';
    S.settings.cols = 4;
    S.settings.rows = 2;
    S.welcomed = true; closeModal(true);
    S.showBacks = false;
    S.showCuts = false;
    renderAll();
    await drawPreview();

    // 3. Verify Card Queue elements
    const queueHd = $('.queue-hd');
    eq('queue header visible', !!queueHd && getComputedStyle(queueHd).display !== 'none', true);
    eq('queue copy count displays 2 copies', $('#queueCopyCount').textContent, '2 copies');
    eq('queue ready status populated', $('#queueReadyStatus').textContent.length > 0, true);

    const cards = $$('#cardList .card');
    eq('two card rows rendered', cards.length, 2);
    const copyBadge = cards[0].querySelector('.copy-badge');
    eq('card row has one visible quantity editor', cards[0].querySelectorAll('input[data-act=qty]').length, 1);
    eq('duplicate quantity badge is hidden', getComputedStyle(copyBadge).display, 'none');

    // 4. Verify Center Proof Stage and View Controls
    eq('proof sheet label displays Sheet 1 of 1', $('#proofSheetLabel').textContent, 'Sheet 1 of 1');
    eq('proof front button on', $('#btnProofFront').classList.contains('on'), true);
    eq('proof back button off', $('#btnProofBack').classList.contains('on'), false);
    eq('proof guides button off', $('#btnProofGuides').classList.contains('on'), false);

    // Click Back view button
    $('#btnProofBack').click();
    eq('showBacks enabled via proof toggle', S.showBacks, true);
    eq('proof back button now on', $('#btnProofBack').classList.contains('on'), true);

    // Click Guides toggle button
    $('#btnProofGuides').click();
    eq('showCuts enabled via proof toggle', S.showCuts, true);
    eq('proof guides button now on', $('#btnProofGuides').classList.contains('on'), true);

    // Click Front view button
    $('#btnProofFront').click();
    eq('showBacks disabled via front button', S.showBacks, false);

    // 5. Verify Card Detail Footer
    eq('proof card footer hidden without selection', $('#proofCardFooter').style.display, 'none');
    selectCardCopy('c1', 0);
    eq('proof card name populated', $('#proofCardName').textContent, 'Black Lotus');
    eq('proof card trim dimensions displayed', $('#proofCardTrim').textContent.includes('63 × 88 mm trim'), true);

    // 6. Verify Right Inspector Summaries
    eq('inspector paper contains Letter · Landscape', $('#inspPaper').textContent.includes('Letter') && $('#inspPaper').textContent.includes('Landscape'), true);
    eq('inspector layout shows 4 × 2', $('#inspLayout').textContent.includes('4 × 2'), true);
    eq('inspector sides shows Single-sided when no backs', $('#inspSides').textContent, 'Single-sided');
    eq('inspector cut shows Cut by hand', $('#inspCut').textContent, 'Cut by hand');
    eq('inspector calibration populated', $('#inspCal').textContent.length > 0, true);

    // 7. Verify Persistent Bottom Export Bar
    const bar = $('#workspaceBar');
    eq('workspace export bar exists', !!bar, true);
    eq('workspace export bar has ready status', /Checking|Ready|Review warnings|Blocked/.test($('#barStatus').textContent), true);
    eq('workspace review export button exists', !!$('#btnReviewExport'), true);

    if (fails.length) return {failed: fails};
    return true;
  } catch (err) {
    return {failed: [`Unexpected error: ${err.message}\n${err.stack}`]};
  }
})();
