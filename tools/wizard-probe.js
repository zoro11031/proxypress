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

    // 2. Assert Print setup contains NO Cameo options or presets
    switchTab('setup');
    eq('no cameo in print presets', /Cameo/i.test($('#presetGrid').innerHTML), false);
    eq('no cameo in print form', /Silhouette Cameo/i.test($('#settingsForm').innerHTML), false);

    // Paper choice must survive printer presets and cutter changes.
    for (const [size, w, h] of [['a4', 210, 297], ['letter', 215.9, 279.4]]) {
      const paper = $('#paperForm [data-k="pageSize"]');
      paper.value = size;
      paper.dispatchEvent(new Event('change', {bubbles:true}));
      eq(`${size} saved`, S.settings.pageSize, size);
      for (const p of BUILTIN_PRESETS.filter(p => p.kind)) {
        applyPreset(p);
        eq(`${size} preserved by ${p.id}`, S.settings.pageSize, size);
        eq(`${size} preset preview width`, presetPer(p).W, p.settings.orientation === 'landscape' ? h : w);
      }
      renderAll();
      eq(`${size} driver instructions`, $('#printerGuide').textContent.includes(size === 'a4' ? 'A4 (210×297 mm)' : 'Letter (8.5×11 in)'), true);
      $('#btnCutModeRotary').click();
      $(`#presetGrid [data-preset="${size === 'a4' ? 'b-a4-land' : 'b-letter-land'}"]`).click();
      $('#btnCutModeCameo').click();
      const L = layout();
      eq(`${size} cameo paper`, S.settings.pageSize, size);
      eq(`${size} landscape width`, L.W, h);
      eq(`${size} landscape height`, L.H, w);
      eq(`${size} cameo fits`, L.fits && !regConflict(L), true);
      eq(`${size} cameo cards`, L.per, 8);
      $('#btnCutModeRotary').click();
      eq(`${size} rotary paper`, S.settings.pageSize, size);
    }

    eq('printer preset groups removed', $$('[data-preset-choice]').length, 0);
    eq('paper presets retained', $$('#presetGrid [data-preset]').length, 4);
    Object.assign(S.settings, {offsetX:1.2, scaleY:99.8, brightness:107, dpi:600, duplexMethod:'auto'});
    const preserved = () => JSON.stringify([S.settings.offsetX, S.settings.scaleY, S.settings.brightness, S.settings.dpi, S.settings.duplexMethod]);
    const before = preserved();
    S.settings.cardRotation = 'rotated';
    $('#presetGrid [data-preset="b-a4"]').click();
    eq('portrait paper uses upright cards', !!layout().rot, false);
    eq('paper preserves alignment and print choices', preserved(), before);
    $('#printerSel').value = 'Laser';
    $('#printerSel').dispatchEvent(new Event('change'));
    eq('printer preserves alignment and print choices', preserved(), before);
    eq('printer type options', $('#printerSel').options.length, 2);
    eq('laser model list', [...$('#driverPrinterSel').options].every(o => printerOf(o.value).kind === 'Laser'), true);
    $('#driverDetails').open = true;
    $('#driverPrinterSel').value = 'laser';
    $('#driverPrinterSel').dispatchEvent(new Event('change', {bubbles:true}));
    eq('model selection applied', S.printer, 'laser');
    eq('model selection keeps drawer open', $('#driverDetails').open, true);
    $('#printerSel').value = 'Inkjet'; $('#printerSel').dispatchEvent(new Event('change'));
    $('#printerSel').value = 'Laser'; $('#printerSel').dispatchEvent(new Event('change'));
    eq('printer model remembered per type', S.printer, 'laser');
    eq('calibration fields grouped with test sheets', !!$('#calDrawer [data-k="offsetX"]'), true);
    eq('no duplicate calibration fields', $$('[data-k="offsetX"]').length, 1);
    for (const pr of PRINTERS) {
      $('#printerSel').value = pr.kind; $('#printerSel').dispatchEvent(new Event('change'));
      const settings = JSON.stringify(S.settings);
      $('#driverDetails').open = true;
      $('#driverPrinterSel').value = pr.id;
      $('#driverPrinterSel').dispatchEvent(new Event('change', {bubbles:true}));
      eq(`${pr.id} model selected`, S.printer, pr.id);
      eq(`${pr.id} preserves print settings`, JSON.stringify(S.settings), settings);
      eq(`${pr.id} has manufacturer links`, !!$('#driverDetails a[target="_blank"]'), true);
    }

    $('#btnCutModeCameo').click();
    eq('cameo offers both paper orientations', $$('#presetGrid [data-preset]').length, 4);
    for (const id of ['b-letter', 'b-a4']) {
      $(`#presetGrid [data-preset="${id}"]`).click();
      eq(`${id} cameo portrait selected`, S.settings.orientation, 'portrait');
      eq(`${id} cameo portrait upright`, !!layout().rot, false);
      eq(`${id} cameo portrait fits nine`, `${layout().cols}x${layout().rows}`, '3x3');
      eq(`${id} cameo portrait fits`, layout().fits && !regConflict(layout()), true);
      eq(`${id} keeps registration marks`, S.settings.silhouette, true);
      eq(`${id} capacity matches preview`, presetPer(BUILTIN_PRESETS.find(p => p.id === id)).per, layout().per);
    }
    $('#presetGrid [data-preset="b-letter-land"]').click();
    eq('cameo paper choice fits', layout().fits && !regConflict(layout()), true);
    eq('cameo preview capacity matches effective layout', presetPer(BUILTIN_PRESETS.find(p => p.id === 'b-letter-land')).per, layout().per);
    $('#btnCutModeRotary').click();

    for (const printer of ['et2800', 'mf753']) {
      S.printer = printer; S.settings = {...DEFAULTS}; renderAll();
      for (const id of ['b-letter', 'b-a4']) {
        $(`#presetGrid [data-preset="${id}"]`).click();
        eq(`${printer} ${id} rotary nine cards`, `${layout().cols}x${layout().rows}`, '3x3');
        eq(`${printer} ${id} rotary fits`, layout().fits, true);
        eq(`${printer} ${id} full-size cards`, `${S.settings.cardW}x${S.settings.cardH}`, '63x88');
        eq(`${printer} ${id} bleed field valid`, $('#rotaryBleed').checkValidity(), true);
        $('#btnCutModeCameo').click();
        eq(`${printer} ${id} Cameo keeps portrait`, S.settings.orientation, 'portrait');
        eq(`${printer} ${id} Cameo nine cards`, layout().per, 9);
        eq(`${printer} ${id} marks clear cards`, regConflict(layout()), false);
        eq(`${printer} ${id} marks stay printable`, S.settings.regInset - S.settings.regThickness / 2 >= 5, true);
        $('#btnCutModeRotary').click();
        eq(`${printer} ${id} rotary keeps nine`, layout().per, 9);
        eq(`${printer} ${id} compact rotary ready`, !!$('#cutApply'), false);
      }
    }

    // 3. Assert next/prev wizard buttons
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

    // 4. Test Cameo vs Rotary cutter toggle and tool-scoped advanced settings
    switchTab('cutting');
    $('#btnCutModeCameo').click();
    eq('cameo enabled', S.settings.silhouette, true);
    eq('cameo guides none', S.settings.guides, 'none');
    eq('cameo showCuts false', S.settings.showCuts, false);
    eq('cameo section visible', $('#cameoSection').style.display !== 'none', true);
    eq('rotary section hidden', $('#rotarySection').style.display === 'none', true);
    eq('cameo adv drawer exists', !!$('#cameoAdvDrawer'), true);

    // Test Cameo advanced controls
    $('#cameoRegPattern').value = '4';
    $('#cameoRegPattern').dispatchEvent(new Event('change'));
    eq('cameo regPattern updated', S.settings.regPattern, 4);

    $('#cameoRegInset').value = '3.5';
    $('#cameoRegInset').dispatchEvent(new Event('change'));
    eq('cameo regInset updated', S.settings.regInset, 3.5);

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
    eq('rotary adv drawer exists', !!$('#rotaryAdvDrawer'), true);

    // Test Rotary advanced controls
    $('#rotaryGuides').value = 'corners';
    $('#rotaryGuides').dispatchEvent(new Event('change'));
    eq('rotary guides updated', S.settings.guides, 'corners');

    $('#rotaryBleed').value = '1.5';
    $('#rotaryBleed').dispatchEvent(new Event('change'));
    eq('rotary bleed updated', S.settings.bleed, 1.5);
    const rotary = JSON.stringify(S.settings);
    $('#btnCutModeRotary').click();
    eq('selected rotary leaves overrides intact', JSON.stringify(S.settings), rotary);
    eq('rotary status describes corner guides', /Corner marks enabled/.test($('#cutStatus').textContent), true);
    eq('rotary status excludes margin guides', /Margin lines/.test($('#cutStatus').textContent), false);

    switchTab('guide');
    eq('guide shows rotary badge', $('#guideCutterBadge').textContent, 'Rotary Trimmer');
    eq('guide hides cameo svg button', $('#btnExportSvgTab').style.display === 'none', true);
    eq('guide contains stop block trick', /stop-block/i.test($('#tabGuidePaneCut').innerHTML), true);
    eq('guide contains kadomaru punch', /Kadomaru/i.test($('#tabGuidePaneCut').innerHTML), true);

    // 5. Test Guide Subtabs toggle
    $('#tabGuideBtnCut').click();
    eq('cut pane visible', $('#tabGuidePaneCut').style.display !== 'none', true);
    eq('print pane hidden', $('#tabGuidePanePrint').style.display === 'none', true);

    $('#tabGuideBtnPrint').click();
    eq('print pane visible', $('#tabGuidePanePrint').style.display !== 'none', true);
    eq('cut pane hidden', $('#tabGuidePaneCut').style.display === 'none', true);

    // 6. Test Live Duplex Paper Flip in Guide
    const oldEntries = deck().entries;
    deck().entries = [{uid:uid(), name:'Duplex test', qty:1, faces:[{name:'Front'}, {name:'Back'}]}];
    S.settings.dfcMode = 'duplex';
    S.settings.duplexMethod = 'manual';
    S.settings.orientation = 'landscape';
    renderGuideTab();
    eq('landscape manual paper flip mentions top to bottom', /top to bottom/i.test($('#tabGuidePanePrint').innerHTML), true);

    S.settings.orientation = 'portrait';
    renderGuideTab();
    eq('portrait manual paper flip mentions left to right', /left to right/i.test($('#tabGuidePanePrint').innerHTML), true);

    deck().entries = oldEntries;

    // 7. Test Step Idempotency and Order Independence (Step 2 must not clobber Step 3 cut settings)
    switchTab('cutting');
    $('#btnCutModeRotary').click();
    $('#rotaryBleed').value = '2.5';
    $('#rotaryBleed').dispatchEvent(new Event('change'));
    $('#rotaryGuides').value = 'corners';
    $('#rotaryGuides').dispatchEvent(new Event('change'));
    eq('rotary custom bleed set', S.settings.bleed, 2.5);
    eq('rotary custom guides set', S.settings.guides, 'corners');

    // Go back to Step 2 and apply presets, change printer, change paper
    switchTab('setup');
    const laserPreset = BUILTIN_PRESETS.find(p => p.kind === 'Laser' && p.settings.orientation === 'landscape');
    applyPreset(laserPreset);
    eq('bleed preserved after applying preset', S.settings.bleed, 2.5);
    eq('guides preserved after applying preset', S.settings.guides, 'corners');
    eq('silhouette preserved after applying preset', S.settings.silhouette, false);

    // Change printer in Step 2
    $('#printerSel').value = 'Inkjet';
    $('#printerSel').dispatchEvent(new Event('change'));
    eq('bleed preserved after changing printer', S.settings.bleed, 2.5);
    eq('guides preserved after changing printer', S.settings.guides, 'corners');

    // Switch to Cameo in Step 3
    switchTab('cutting');
    $('#btnCutModeCameo').click();
    eq('cameo active', S.settings.silhouette, true);
    eq('cameo bleed', S.settings.bleed, 0.625);

    // Go back to Step 2 and apply an inkjet preset
    switchTab('setup');
    const inkjetPreset = BUILTIN_PRESETS.find(p => p.kind === 'Inkjet' && p.settings.orientation === 'landscape');
    applyPreset(inkjetPreset);
    eq('cameo silhouette preserved after inkjet preset', S.settings.silhouette, true);
    eq('cameo bleed preserved after inkjet preset', S.settings.bleed, 0.625);
    eq('cameo guides preserved after inkjet preset', S.settings.guides, 'none');

    // Return to rotary
    switchTab('cutting');
    $('#btnCutModeRotary').click();
    eq('rotary restored', S.settings.silhouette, false);

  } catch (err) {
    fails.push(`Unexpected error: ${err.message}\n${err.stack}`);
  }

  return fails.length ? {failed: fails} : true;
})();
