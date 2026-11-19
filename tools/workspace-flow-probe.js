// Run with node tools/console-check.js --offline-fixtures --probe tools/workspace-flow-probe.js
// Repeat with --width 390 to exercise the mobile queue and settings.
(async () => {
  const failures = [];
  const check = (condition, message) => { if (!condition) failures.push(message); };
  const waitFor = async predicate => {
    for (let attempt = 0; attempt < 50; attempt++) {
      if (await predicate()) return true;
      await sleep(20);
    }
    return false;
  };
  const click = selector => $(selector)?.click();
  const select = (selector, value) => {
    const control = $(selector);
    control.value = value;
    control.dispatchEvent(new Event('change', {bubbles:true}));
  };
  const visible = selector => !!$(selector)?.getClientRects().length;

  setPreviewFocus(false);
  setWorkspaceView('cards');
  deck().entries = [];
  S.settings = {...DEFAULTS,orientation:'landscape',cardRotation:'upright',bleed:0.625};
  renderAll();
  await waitFor(()=>$('#barStatus').textContent.includes('Add cards'));
  click('#btnReviewExport');
  await waitFor(()=>$('[data-review-issue]'));
  check($('[data-review-issue]')?.textContent === 'Add cards', 'Empty review needs a direct Add cards action.');
  click('[data-review-issue]');
  check(document.activeElement === $('#listIn'), 'Add cards from review should focus the import box.');

  openPrintSettings('layout');
  await waitFor(()=>visible('#printSettingsView'));
  check(visible('#btnReviewExport'), 'Review export should stay visible in Print Settings.');
  click('#btnReviewExport');
  check($('#modalTitle')?.textContent === 'Review export', 'Review should open from Print Settings.');
  closeModal();
  check(document.body.classList.contains('print-settings-active'), 'Closing review should return to Print Settings.');
  backToProof();

  const fixture = document.createElement('canvas');
  fixture.width = 744; fixture.height = 1039;
  const custom = await storeImage(await new Promise(resolve=>fixture.toBlob(resolve)));
  const front = {name:'Fixture front',custom};
  const back = {name:'Fixture back',custom};
  const entry = {uid:'workspace-fixture',name:'Fixture',qty:10,kind:'CARD',faces:[front,back]};
  deck().entries = [entry];
  renderAll();
  await drawPreview();
  click('#btnProofBack');
  check($('#btnProofGuides').disabled, 'Front guide controls should be disabled on the back proof.');
  click('#btnReviewExport');
  select('#exportScope','current');
  select('#exportSheet','1');
  check(S.activeSheet === 1, 'The sheet chooser should update the selected sheet.');
  check(/2 cards · 1 sheet/.test($('#guideJobSummary').textContent), 'The review should summarize the selected sheet.');
  closeModal();

  entry.qty = 1;
  entry.faces = [front];
  renderAll();
  await drawPreview();
  check($('#exportScope').value === 'all', 'A removed sheet should reset the review scope.');
  check($('#btnProofBack').disabled && !S.showBacks, 'Removing the backs should return the proof to the front.');
  S.settings.cols = 100;
  renderAll();
  click('#btnReviewExport');
  await waitFor(()=>$('[data-review-issue]'));
  check($('[data-review-issue]')?.textContent === 'Review print setup', 'The invalid grid should link to Layout.');
  click('[data-review-issue]');
  check($('#btnBackToProof').textContent.includes('Back to export review'), 'Settings should preserve the review return path.');
  backToProof();
  check($('#modalTitle')?.textContent === 'Review export', 'Returning from Layout should reopen review.');
  closeModal();

  openPrintSettings('color');
  const customFoil = {brightness:118, saturation:143, contrast:108, foilTint:4};
  Object.assign(S.settings, customFoil);
  renderColorSliders();
  check(visible('#saveFoilColors'), 'Color settings should offer to save a foil default.');
  check($$('#btnInspFoilPreview').length === 1 && $$('#btnInspFoilTestSheet').length === 1, 'Foil actions should appear once.');
  click('#saveFoilColors');
  check(await waitFor(async()=> (await store.get('kv','ui'))?.foilColorDefaults?.brightness === customFoil.brightness), 'The foil default should save with browser settings.');
  click('[data-color-profile="standard"]');
  check(matchesPrintColors(DEFAULTS), 'Standard paper should apply neutral colors.');
  click('[data-color-profile="foil"]');
  check(matchesPrintColors(customFoil), 'My foil colors should apply the saved values.');
  for (const [id,orientation] of [['b-foil-letter-land','landscape'],['b-foil-letter-port','portrait']]) {
    const selector = `#stockPresetGrid [data-preset="${id}"]`;
    check(visible(selector), `Letter foil should offer ${orientation}.`);
    click(selector);
    check(S.settings.pageSize === 'letter' && S.settings.orientation === orientation && matchesPrintColors(customFoil), `Letter foil ${orientation} should apply the layout and saved colors.`);
  }
  click('[data-preset="b-foil-land"]');
  check(matchesPrintColors(customFoil), 'Foil paper layouts should use the saved colors.');
  const restored = await prepareBackupRestore({foilColorDefaults:customFoil});
  check(restored.foilColorDefaults?.foilTint === customFoil.foilTint, 'Backups should restore the foil default.');
  click('#resetFoilColors');
  check(matchesPrintColors(customFoil), 'Resetting the default should preserve current deck colors.');
  click('[data-color-profile="foil"]');
  check(matchesPrintColors(DEFAULT_FOIL_COLORS), 'Reset should restore the original foil defaults.');

  openPrintSettings('cutting');
  click('#btnCutModeCameo');
  check(visible('#cameoPaperSize') && $('#cameoPaperSize').value === 'a4', 'Cutting should show the current paper size.');
  check(layout().scm === 'a4-standard-v5.studio3', 'A4 should use the A4 stock template.');
  select('#cameoPaperSize','letter');
  check(layout().scm === 'letter-standard-v6.studio3' && $('#setting-pageSize').value === 'letter', 'Choosing Letter should change the template and the print paper together.');
  check($('#scmTemplateHint').hidden, 'Stock templates need no extra description.');
  check(cleanSettings({silhouette:true,scmTemplate:'custom'}).scmTemplate === 'standard', 'Older Cameo projects should use the standard template by default.');
  check(cleanSettings({silhouette:true,scmTemplate:'custom',regPattern:4}).scmTemplate === 'custom', 'Older Cameo projects with custom registration marks should keep their layout.');
  select('#scmTemplate','custom');
  check(cleanSettings(S.settings).scmTemplate === 'custom', 'Explicit custom layouts should survive reload.');
  select('#scmTemplate','standard');
  select('#cameoPaperSize','legal');
  select('#scmTemplate','borderless');
  select('#cameoPaperSize','arch_b');
  check(S.settings.scmTemplate === 'standard', 'Paper with no borderless template should use its standard template.');
  select('#cameoPaperSize','custom');
  check(S.settings.scmTemplate === 'custom', 'Unsupported paper should fall back to a custom layout.');
  select('#cameoPaperSize','letter');
  check(layout().scm === 'letter-standard-v6.studio3', 'Returning to supported paper should restore the stock layout.');

  backToProof();
  entry.qty = 9;
  renderAll();
  await drawPreview();
  click('#btnReviewExport');
  $('#separateCutFiles').open = true;
  check(await waitFor(()=>!$('#btnExportStudio3Tab').disabled), 'A stock Letter job should offer a native Studio download for its full sheet.');
  check(/1 of 2 sheets/.test($('#cutFileHint').textContent), 'Review should explain which sheets have Studio files.');
  const originalDownload = download;
  let studioDownload;
  try {
    download = (blob,name) => { studioDownload = {size:blob.size,name}; };
    click('#btnExportStudio3Tab');
    check(await waitFor(()=>studioDownload?.size === 76004 && studioDownload.name.endsWith('sheet-1.studio3')), 'The download should deliver the matching full sheet document.');
  } finally {
    download = originalDownload;
  }
  check(/Silhouette Card Maker/.test($('#cameoJobHint').textContent) && visible('#btnReviewCutting'), 'Review should show the active layout and a stable route to its settings.');
  select('#exportScope','current');
  select('#exportSheet','1');
  check(await waitFor(()=>/partial/.test($('#cutFileHint').textContent)), 'A partial sheet without a matching Studio file should point to DXF.');
  check($('#btnExportStudio3Tab').disabled && !$('#btnExportDxfTab').disabled, 'DXF should stay available for the partial sheet.');
  click('#btnReviewCutting');
  check($('#btnBackToProof').textContent.includes('Back to export review'), 'Cutting settings should preserve the review return path.');
  select('#scmTemplate','borderless');
  backToProof();
  check(await waitFor(()=>!$('#btnExportStudio3Tab').disabled), 'The full borderless Letter sheet should offer a native Studio download.');
  check(/borderless/.test($('#cameoJobHint').textContent), 'Review should confirm the new layout.');
  closeModal();
  openPrintSettings('cutting');
  select('#scmTemplate','standard');
  check($('#scmFit').value === 'crop' && $('#scmFitBack').value === 'same', 'Center crop should be the default for both sides.');
  check(cleanSettings({scmFit:'stretch',scmFitBack:'stretch'}).scmFit === 'crop', 'Projects with the old front default should switch to crop.');
  check(cleanSettings({scmFitBack:'stretch'}).scmFitBack === 'stretch', 'An explicit back fit should survive migration.');
  select('#scmFit','stretch');
  check(cleanSettings(S.settings).scmFit === 'stretch', 'Choosing stretch should preserve that choice on reload.');
  select('#scmFit','crop');
  select('#cameoPaperSize','a4');
  openPrintSettings('color');
  check(!$('#stockPresetGrid [data-preset="b-foil-letter-port"]'), 'Stock Silhouette should show one foil choice per paper size.');
  click('#stockPresetGrid [data-preset="b-foil-letter-land"]');
  check(layout().scm === 'letter-standard-v6.studio3' && matchesPrintColors(DEFAULT_FOIL_COLORS), 'Letter foil should use the Letter stock template and foil colors.');
  openPrintSettings('cutting');
  openDuplexWizard();
  check(!$('#duplexWizardChoices [data-flip="short"]'), 'The stock template should offer its supported flip only.');
  closeModal();
  click('#btnCutModeRotary');
  click('[data-guide="margin"]');
  check(S.settings.guides === 'margin' && $('[data-guide="none"]').getAttribute('aria-pressed') === 'false', 'Margin marks should be selectable from the guide buttons.');
  click('[data-guide="corners"]');
  check(S.settings.guides === 'corners', 'Choosing corners should replace margin-only guides.');
  backToProof();

  deck().entries = [];
  click('[data-mode=order]');
  setWorkspaceView('proof');
  await drawPreview();
  check(visible('#orderQueueToggle'), 'The empty Order gallery should offer access to the queue.');
  click('#orderQueueToggle');
  if (innerWidth <= 820) {
    check(document.body.dataset.workspaceView === 'cards', 'The mobile gallery should return to Cards.');
  } else {
    await waitFor(()=>$('#orderQueueToggle')?.textContent === 'Show queue');
    check(visible('#orderQueueToggle'), 'Hiding the queue should leave its toggle visible.');
    click('#orderQueueToggle');
    check(!document.body.classList.contains('preview-focus'), 'The gallery toggle should restore the queue.');
  }

  if (failures.length) return {failures};
  console.log('PASS workspace flows: import, review, foil defaults, cutting, and Order queue');
  return true;
})()
