// Probe for tools/console-check.js --probe. Runs inside the page.
// Tests the 4-step wizard workflow, tab transitions, cutter switching, and operator guide rendering.
(() => {
  const fails = [];
  const eq = (name, got, want) => { if (got !== want) fails.push(`${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); };

  try {
    // 1. Assert all 4 tabs exist and switchTab works
    switchTab('cards');
    eq('cards tab on', $('#tab-cards').classList.contains('on'), true);
    eq('cards button on', $('.tabs button[data-tab="cards"]').classList.contains('on'), true);

    switchTab('setup');
    eq('setup tab on', $('#tab-setup').classList.contains('on'), true);
    eq('setup button on', $('.tabs button[data-tab="setup"]').classList.contains('on'), true);

    switchTab('cutting');
    eq('cutting tab on', $('#tab-cutting').classList.contains('on'), true);
    eq('cutting button on', $('.tabs button[data-tab="cutting"]').classList.contains('on'), true);

    switchTab('guide');
    eq('guide tab on', $('#tab-guide').classList.contains('on'), true);
    eq('guide button on', $('.tabs button[data-tab="guide"]').classList.contains('on'), true);

    // 2. Assert next/prev wizard buttons
    $('#btnStep4Prev').click();
    eq('prev from guide goes to cutting', $('#tab-cutting').classList.contains('on'), true);

    $('#btnStep3Prev').click();
    eq('prev from cutting goes to setup', $('#tab-setup').classList.contains('on'), true);

    $('#btnStep2Prev').click();
    eq('prev from setup goes to cards', $('#tab-cards').classList.contains('on'), true);

    $('#btnStep1Next').click();
    eq('next from cards goes to setup', $('#tab-setup').classList.contains('on'), true);

    $('#btnStep2Next').click();
    eq('next from setup goes to cutting', $('#tab-cutting').classList.contains('on'), true);

    $('#btnStep3Next').click();
    eq('next from cutting goes to guide', $('#tab-guide').classList.contains('on'), true);

    // 3. Test Cameo vs Rotary cutter toggle
    switchTab('cutting');
    $('#btnCutModeCameo').click();
    eq('cameo enabled', S.settings.silhouette, true);
    eq('cameo guides none', S.settings.guides, 'none');
    eq('cameo showCuts false', S.settings.showCuts, false);
    eq('cameo section visible', $('#cameoSection').style.display !== 'none', true);
    eq('rotary section hidden', $('#rotarySection').style.display === 'none', true);

    switchTab('guide');
    eq('guide shows cameo badge', $('#guideCutterBadge').textContent, 'Silhouette Cameo');
    eq('guide shows cameo svg button', $('#btnExportSvgTab').style.display !== 'none', true);
    eq('guide contains sensor trick', /optical sensor/i.test($('#tabGuidePaneCut').innerHTML), true);
    eq('guide contains 330gsm specs', /330gsm/i.test($('#tabGuidePaneCut').innerHTML), true);

    switchTab('cutting');
    $('#btnCutModeRotary').click();
    eq('rotary disabled cameo', S.settings.silhouette, false);
    eq('rotary guides both', S.settings.guides, 'both');
    eq('rotary section visible', $('#rotarySection').style.display !== 'none', true);
    eq('cameo section hidden', $('#cameoSection').style.display === 'none', true);

    switchTab('guide');
    eq('guide shows rotary badge', $('#guideCutterBadge').textContent, 'Rotary Trimmer');
    eq('guide hides cameo svg button', $('#btnExportSvgTab').style.display === 'none', true);
    eq('guide contains stop block trick', /stop-block/i.test($('#tabGuidePaneCut').innerHTML), true);
    eq('guide contains kadomaru punch', /Kadomaru/i.test($('#tabGuidePaneCut').innerHTML), true);

    // 4. Test Guide Subtabs toggle
    $('#tabGuideBtnCut').click();
    eq('cut pane visible', $('#tabGuidePaneCut').style.display !== 'none', true);
    eq('print pane hidden', $('#tabGuidePanePrint').style.display === 'none', true);

    $('#tabGuideBtnPrint').click();
    eq('print pane visible', $('#tabGuidePanePrint').style.display !== 'none', true);
    eq('cut pane hidden', $('#tabGuidePaneCut').style.display === 'none', true);

    // 5. Test Live Duplex Paper Flip in Guide
    S.settings.dfcMode = 'duplex';
    S.settings.duplexMethod = 'manual';
    S.settings.orientation = 'landscape';
    renderGuideTab();
    eq('landscape manual paper flip mentions top to bottom', /top to bottom/i.test($('#tabGuidePanePrint').innerHTML), true);

    S.settings.orientation = 'portrait';
    renderGuideTab();
    eq('portrait manual paper flip mentions left to right', /left to right/i.test($('#tabGuidePanePrint').innerHTML), true);

  } catch (err) {
    fails.push(`Unexpected error: ${err.message}\n${err.stack}`);
  }

  return fails.length ? {failed: fails} : true;
})();
