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
  const press = (selector, key) => {
    const event = new Event('keydown', {bubbles:true, cancelable:true});
    Object.defineProperty(event, 'key', {value:key});
    $(selector)?.dispatchEvent(event);
  };
  const select = (selector, value) => {
    const control = $(selector);
    control.value = value;
    control.dispatchEvent(new Event('change', {bubbles:true}));
  };
  const type = (selector, value) => {
    const input = $(selector);
    input.value = value;
    input.dispatchEvent(new Event('input', {bubbles:true}));
  };
  const visible = selector => !!$(selector)?.getClientRects().length;

  setPreviewFocus(false);
  setWorkspaceView('cards');
  deck().entries = [];
  S.settings = {...DEFAULTS,orientation:'landscape',cardRotation:'upright',bleed:0.625};
  renderAll();
  await drawPreview();
  check($('#previewSheetNav')?.hidden && $('#previewZoomControls')?.hidden, 'An empty preview should show import actions without sheet or zoom controls.');
  check($('#proofViewSeg').getAttribute('aria-label') === 'Preview side and guides', 'Screen-reader labels should call this Preview.');
  if (innerWidth > 820) {
    click('#toggleSidebar');
    check($('#toggleSidebar').getAttribute('aria-expanded') === 'false', 'The card list toggle should announce when the list is hidden.');
    click('#btnShowPrintSetup');
    check($('#toggleSidebar').textContent === 'Hide card list' && $('#toggleSidebar').getAttribute('aria-expanded') === 'true', 'Showing print shortcuts should update the reopened card list toggle.');
  }
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
  const nextEntry = {...entry, uid:'workspace-next', qty:1};
  deck().entries.push(nextEntry);
  renderCards();
  click('#cardList [data-uid="workspace-next"] [data-act="jump"]');
  check(await waitFor(()=>document.activeElement.dataset.uid === nextEntry.uid) && S.activeSheet === 1, 'Clicking a card should focus it on its own preview sheet.');
  deck().entries.pop();
  renderCards();
  await showSheet(0, 'front');

  setWorkspaceView('cards');
  click('#btnReplace');
  $('#listIn').value = '2 Fixture';
  $('#listIn').dispatchEvent(new Event('input', {bubbles:true}));
  check(deck().importDraft?.replace && $('#btnImport').textContent === 'Review replacement', 'Editing a replacement draft should preserve its intended action.');
  const savedDraft = await waitFor(async () => (await store.get('kv','decks'))?.find(d=>d.id === deck().id)?.importDraft?.replace);
  check(savedDraft, 'The replacement action should be saved with the decklist.');
  $('#listIn').value = '';
  if (typeof restoreDeckImport === 'function') restoreDeckImport();
  check($('#listIn').value === '2 Fixture', 'The saved decklist should return to the import box.');
  click('#btnAddCards');
  check($('#btnResumeImport').textContent === 'Resume replacement' && visible('#btnResumeImport'), 'A closed replacement draft should have a clearly labeled resume action.');
  click('#btnResumeImport');
  const originalResolver = resolveDeckImport;
  try {
    resolveDeckImport = async () => ({resolved:[{...entry,qty:2}],unresolved:[],rows:[]});
    click('#btnImport');
    check(await waitFor(()=>$('#btnReviewConfirm')) && $('#btnReviewConfirm').textContent === 'Replace deck', 'A resumed draft should open replacement confirmation.');
    closeModal();
    check(entry.qty === 10, 'Closing replacement review should preserve the deck.');
  } finally {
    resolveDeckImport = originalResolver;
  }
  click('#btnAddInstead');
  check($('#btnImport').textContent === 'Add to deck' && $('#listIn').value === '2 Fixture' && !deck().importDraft?.replace, 'Add instead should retain the list and exit replacement mode.');
  const clipboardProperty = Object.getOwnPropertyDescriptor(navigator,'clipboard');
  try {
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async () => { throw new Error('Clipboard unavailable'); }}});
    click('#btnCopyList');
    check(await waitFor(()=>$('#decklistCopyText')) && $('#listIn').value === '2 Fixture', 'When clipboard access fails, show a copyable decklist without replacing the import draft.');
    closeModal();
  } finally {
    if (clipboardProperty) Object.defineProperty(navigator,'clipboard',clipboardProperty);
    else delete navigator.clipboard;
  }
  $('#listIn').value = '';
  $('#listIn').dispatchEvent(new Event('input', {bubbles:true}));

  click('#btnProofBack');
  check($('#btnProofGuides').disabled, 'Front guide controls should be disabled on the back preview.');
  click('#btnReviewExport');
  select('#exportScope','current');
  select('#exportSheet','1');
  check(S.exportSheet === 1 && S.activeSheet === 0, 'Exporting one sheet should leave the preview sheet alone.');
  check(/2 cards · 1 sheet/.test($('#guideJobSummary').textContent), 'The review should summarize the selected sheet.');
  closeModal();

  entry.qty = 1;
  entry.faces = [front];
  renderAll();
  await drawPreview();
  check($('#exportScope').value === 'all', 'A removed sheet should reset the review scope.');
  check($('#btnProofBack').disabled && !S.showBacks, 'Removing the backs should return the preview to the front.');
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
  const brightness = $('#setting-brightness');
  brightness.focus();
  select('#setting-brightness','122');
  check(document.activeElement === brightness && $('#setting-brightness') === brightness && +$('#num-brightness').value === 122, 'Committing a range adjustment should keep the same focused control and update its number.');
  type('#num-brightness','');
  check(S.settings.brightness === 122, 'Clearing the number while editing should keep the last valid brightness.');
  select('#num-brightness','');
  check(+$('#num-brightness').value === 122, 'Leaving an empty brightness field should restore its last value.');
  select('#setting-brightness',String(customFoil.brightness));
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
  openPrintSettings('layout');
  check($$('#presetGrid .preset-group [data-preset]').length === 2 && !$('#presetGrid [data-preset="b-a4"]'), 'Stock Silhouette should offer one standard preset per paper size.');
  check(visible('#layoutTemplateNote') && $('#setting-orientation').disabled, 'Layout should explain the stock sheet direction.');
  click('#btnChangeLayoutTemplate');
  check($('#printSettingsView').dataset.page === 'cutting', 'Change template should open the Cutting tab.');
  if ($('#printSettingsView').dataset.page !== 'cutting') openPrintSettings('cutting');
  select('#cameoPaperSize','letter');
  check(layout().scm === 'letter-standard-v6.studio3' && $('#setting-pageSize').value === 'letter', 'Choosing Letter should change the template and the print paper together.');
  check(visible('#scmTemplateHint') && /0\.68 mm bleed.*10 mm/.test($('#scmTemplateHint').textContent), 'Show the standard stock bleed and mark inset.');
  S.settings.guides = 'all';
  renderCutStatus();
  check(!$('#cameoStatus').textContent.includes('cut guides are on'), 'Cameo status must ignore stale guides for stock templates.');
  const stock = layout();
  check(cachedGuideLines(stock,stock.per,S.settings).length === 0, 'The stock preview must omit stale printed guides.');
  S.settings.guides = 'none';
  check(cleanSettings({silhouette:true,scmTemplate:'custom'}).scmTemplate === 'standard', 'Older Cameo projects should use the standard template by default.');
  check(cleanSettings({silhouette:true,scmTemplate:'custom',regPattern:4}).scmTemplate === 'custom', 'Older Cameo projects with custom registration marks should keep their layout.');
  select('#scmTemplate','custom');
  check(cleanSettings(S.settings).scmTemplate === 'custom', 'Explicit custom layouts should survive reload.');
  Object.assign(S.settings,{regInset:13.5,regLen:7.5});
  select('#cameoRegPattern','4');
  select('#cameoPaperSize','a4');
  check(S.settings.regInset === 13.5 && S.settings.regLen === 7.5 && S.settings.regPattern === 4, 'Changing the paper should preserve the custom registration settings.');
  openPrintSettings('layout');
  check($$('#presetGrid .preset-group [data-preset]').length === 4, 'Custom Silhouette layouts should offer each orientation.');
  check(!visible('#layoutTemplateNote') && !$('#setting-orientation').disabled, 'Custom layouts should let users change sheet direction.');
  const letterPreset = '#presetGrid [data-preset="b-letter-land"]';
  $(letterPreset).focus();
  click(letterPreset);
  check(S.settings.pageSize === 'letter' && S.settings.regInset === 13.5 && S.settings.regLen === 7.5, 'Applying a paper preset should preserve the custom registration settings.');
  check(document.activeElement === $(letterPreset), 'Applying a sheet preset should return focus to its replacement button.');
  openPrintSettings('cutting');
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
  const cutFiles = $('#separateCutFiles'), cutDisclosure = $('summary',cutFiles), studio = $('#btnExportStudio3Tab');
  check($('#guideDownloadsTitle')?.textContent === 'Downloads' && visible('#btnExportCameoJob'), 'Review should put the ZIP in a dedicated Downloads section.');
  check(await waitFor(()=>!studio.disabled), 'A stock Letter job should offer a native Studio download for its full sheet.');
  check(modalFocusable().includes(cutDisclosure) && !modalFocusable().includes(studio), 'A closed disclosure should be focusable while its controls stay out of the tab sequence.');
  cutFiles.open = true;
  check(/1 of 2 sheets/.test($('#cutFileHint').textContent), 'Review should explain which sheets have Studio files.');
  await downloadCutFile('dxf');
  check($('#cutSheetPicker')?.closest('#separateCutFiles') && document.activeElement === $('#cutSheet'), 'The separate cut picker should sit beside its buttons and receive focus.');
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
  check(visible('#scmTemplateHint') && $('#scmTemplateHint').textContent.includes('3.5 mm'), 'Show the borderless inset for the selected template.');
  backToProof();
  check(await waitFor(()=>!$('#btnExportStudio3Tab').disabled), 'The full borderless Letter sheet should offer a native Studio download.');
  check(/borderless/.test($('#cameoJobHint').textContent), 'Review should confirm the new layout.');
  closeModal();

  entry.qty = 10;
  renderAll();
  openPrintSettings('layout');
  $('#btnReviewExport').focus();
  click('#btnReviewExport');
  select('#exportScope','current');
  select('#exportSheet','1');
  $('#btnReviewCutting').focus();
  click('#btnReviewCutting');
  check($('#btnBackToProof').textContent.includes('Back to export review'), 'Opening Cutting from review should show the same return path inside Settings.');
  backToProof();
  check($('#modalTitle')?.textContent === 'Review export' && $('#exportSheet').value === '1', 'Back should resume review with the selected sheet.');
  check(document.activeElement === $('#btnReviewCutting'), 'Resumed review should restore the Cutting settings button focus.');
  closeModal();
  check($('#printSettingsView').dataset.page === 'layout' && document.activeElement === $('#btnReviewExport'), 'Closing resumed review should restore the original Settings page and opener.');
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
  openPrintSettings('alignment');
  S.settings.offsetX = 2;
  deck().calibrationState = {front:{kind:'measured',scope:'another printer',values:Object.fromEntries(FRONT_CAL_KEYS.map(k=>[k,S.settings[k]]))}};
  refreshAlignmentPage();
  check($('#alignFrontCol').hidden && !visible('#btnCal'), 'Stock layout should lock front controls and the front test.');
  check(getCalibrationStatus().label.includes('Fixed by template') && !getCalibrationStatus().values.includes('Front: X 2'), 'Stock alignment status must reflect the fixed front.');
  const review = buildPrintJob();
  const report = await runPreflight({settings:review.settings,deck:review.project,layout:review.layout,slots:review.slots,
    printer:review.printer,calibration:review.calibration,hasBacks:review.hasBacks});
  check(!report.warnings.some(issue=>issue.type === 'cal_estimated_front'), 'The stock layout should not warn about an unused front correction.');
  const before = makeT(layout(),false).x(25);
  check($('#btnApplyAlignment').disabled && $('#btnResetAlignment').disabled, 'Alignment actions should wait for an edit.');
  $('#input-offsetX').value = '1000';
  type('#input-backOffsetX','125');
  click('#btnApplyAlignment');
  check($('#input-backOffsetX').getAttribute('aria-invalid') === 'true' && $('#alignmentInputError').textContent.includes('extra back offset x'), 'An invalid alignment should identify the field and allowed range.');
  type('#input-backOffsetX','1.25');
  check(!$('#alignmentDraftStatus').hidden && !$('#btnApplyAlignment').disabled, 'An edit should show that it needs to be applied.');
  click('#btnApplyAlignment');
  check(S.settings.offsetX === 2 && S.settings.backOffsetX === 1.25, 'Only back inputs should be applied in stock mode.');
  check(makeT(layout(),false).x(25) === before && makeT(layout(),true).x(25) === before + 1.25, 'Back correction should move the backs only.');
  check($('#btnApplyAlignment').disabled, 'Applying alignment should clear the draft.');
  type('#input-backOffsetX','3.75');
  type('#input-backScaleX','101');
  click('#btnDuplexWizard');
  check(!$('#duplexWizardChoices [data-flip="short"]'), 'The stock template should offer its supported flip only.');
  check(!$('#modal .bd').textContent.includes('check the front first'), 'The stock wizard should direct the user to align the backs.');
  const wizardBackX = 1.25 + (backPageRot(layout()) === 180 ? -0.5 : 0.5);
  const setRead=(id,x,y)=>{for(const [ax,v] of [['x',x],['y',y]]){const el=document.querySelector(`#duplexWizardPoints input[data-id="${id}"][data-ax="${ax}"]`);el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));}};
  setRead('1E', '0.5', '0');
  click('#duplexWizardApply');
  check(S.settings.backOffsetX === wizardBackX && S.settings.offsetX === 2, 'Wizard readings should adjust only the back.');
  closeModal();
  check(+$('#input-backOffsetX').value === wizardBackX && +$('#input-backScaleX').value === 101 && S.settings.backScaleX === 100,
    'Wizard readings should replace old offset edits while preserving unrelated draft values.');
  click('#btnResetAlignment');
  check($('#alignmentDraftStatus').hidden && +$('#input-backScaleX').value === 100, 'Revert should restore the applied values.');

  openPrintSettings('cutting');
  click('#btnCutModeRotary');
  openPrintSettings('alignment');
  check(visible('#alignFrontCol') && visible('#btnCal') && $('#input-offsetX').value === '2', 'Hand cutting should restore the stored front alignment.');
  openPrintSettings('cutting');
  click('[data-guide="margin"]');
  check(S.settings.guides === 'margin' && $('[data-guide="none"]').getAttribute('aria-pressed') === 'false', 'Margin marks should be selectable from the guide buttons.');
  click('[data-guide="corners"]');
  check(S.settings.guides === 'corners', 'Choosing corners should replace margin-only guides.');
  backToProof();

  const originalSf = sf;
  const file = new Blob([await store.get('images',custom)], {type:'image/png'});
  Object.defineProperty(file, 'name', {value:'Fixture front.png'});
  const localImage = {file, key:'fixture front', words:new Set(['fixture','front'])};
  localIndex.push(localImage);
  try {
    let failSearch = true;
    sf = async () => {
      if (failSearch) throw new Error('Test Scryfall connection error');
      return {data:[{name:'Fixture front', set_name:'Test Set', collector_number:'9',
        image_uris:{png:'https://cards.scryfall.io/test.png'}}]};
    };
    openMpcPicker({e:entry, i:0});
    const apply = $('#btnApplyCandidate');
    check(apply.disabled && apply.closest('.art-picker-footer') && !apply.closest('.bd'), 'Apply should stay in the footer outside the scrolling comparison.');
    check($('#artSource-printings')?.getAttribute('aria-selected') === 'true' && $('#tabPanelCommunity').hidden, 'Printings should be selected with other sources hidden.');
    check(await waitFor(()=>visible('#btnRetrySf')) && $('#sfStatus')?.textContent.includes('could not load'), 'An unavailable source should show a retry beside its own results.');
    failSearch = false;
    click('#btnRetrySf');
    check(await waitFor(()=>$('[data-scryfall]')) && $('#btnRetrySf').hidden, 'Retry should replace an error with results.');
    press('#artSource-printings', 'ArrowRight');
    check(document.activeElement === $('#artSource-community') && $('#tabPanelPrintings').hidden && !$('#tabPanelCommunity').hidden, 'Arrow keys should focus and activate the next artwork source.');
    press('#artSource-community', 'End');
    check($('#artSource-local')?.getAttribute('aria-selected') === 'true' && $('#artSource-printings')?.getAttribute('tabindex') === '-1', 'Only the selected source should be in the tab sequence.');
    press('[data-local="0"]', 'Enter');
    check(!apply.disabled && document.activeElement === apply && $('[data-local="0"]')?.getAttribute('aria-pressed') === 'true', 'Selecting a result with Enter should preview it and focus Apply.');
    check(entry.faces[0].custom === custom, 'Previewing artwork should leave the current card untouched.');
    click('#btnCmpCurrent');
    check($('#cmpGrid').classList.contains('show-current') && $('#btnCmpCurrent').getAttribute('aria-pressed') === 'true' && visible('#btnApplyCandidate') && !apply.disabled, 'Comparing the current artwork should keep Apply available.');
    click('#btnApplyCandidate');
    check(await waitFor(()=>!$('#overlay').classList.contains('on')) && entry.faces[0].localName === file.name, 'Apply from Current art should save the chosen image.');
  } finally {
    sf = originalSf;
    localIndex.splice(localIndex.indexOf(localImage),1);
    closeModal();
  }

  click('[data-mode=order]');
  S.orderShowBacks = true;
  const printSheet = S.activeSheet;
  click('#cardList [data-act="jump"]');
  check(await waitFor(()=>document.activeElement.dataset.uid === entry.uid) && !S.orderShowBacks && S.activeSheet === printSheet, 'A card name in Order should reveal its front in the gallery without changing the print sheet.');
  click('#btnReviewExport');
  check($('#orderSummary').textContent.includes('Included in ZIP') && $('#oChooseMissingBack'), 'Order review should show the ZIP count and a cardback action near downloads.');
  check($('#oXml').disabled && $('#xmlSummary').textContent.includes('Use ZIP to include uploads'), 'XML should explain where to get a deck with uploaded artwork.');
  const previousStock = S.mpc.stock;
  S.mpc.foil = true;
  select('#oStock','(P10) Plastic');
  check($('#oFoil').disabled && visible('#oFoilHint'), 'Plastic should explain why foil is unavailable.');
  check(mpcXml(reviewedOrderSnapshots.zip,()=>({id:'test',name:'test',query:'test'})).includes('<foil>false</foil>'), 'Plastic should export without foil even when a foil preference is saved.');
  select('#oStock',previousStock);
  check(!$('#oFoil').disabled && $('#oFoil').checked && !visible('#oFoilHint'), 'Switching back to paper should restore the foil choice.');
  S.mpc.foil = false;
  renderOrder();
  check(modalFocusable().includes($('#stockGuide summary')), 'Compare cardstock should be included in the review tab sequence.');
  click('#oChooseMissingBack');
  check($('#modal .hd [data-close]').textContent.includes('Back to order review'), 'Choosing a missing back should keep the order review return path.');
  check(!visible('.source-nav-tabs') && visible('#tabPanelCommunity') && visible('#pickerCardbackUpload'), 'A cardback should show community artwork and upload without tabs that go nowhere.');
  closeModal();
  check($('#modalTitle')?.textContent === 'Review order', 'Close cardback picker should restore order review.');

  const missingFront = {uid:'fixture-missing-front',name:'Missing front fixture',qty:2,kind:'CARD',faces:[{name:'Missing front fixture'}]};
  const missingBack = {uid:'fixture-missing-back',name:'Missing back fixture',qty:1,kind:'CARD',faces:[entry.faces[0],{name:'Missing back art'}]};
  deck().entries.push(missingFront,missingBack);
  renderOrder();
  check($('#orderSummary').textContent.includes('2 copies need print-ready front art') && $('#orderSummary').textContent.includes('1 copy needs print-ready back art'), 'Order review should distinguish missing fronts from missing backs.');
  check(!$('#oAttach'), 'An ordinary deck should not be sent to the imported-order attachment flow.');
  const fixBack = '[data-fix-order-art="back"]';
  if ($(fixBack)) {
    click(fixBack);
    check($('#modalTitle')?.textContent.includes('editing Back (Missing back art)'), 'Fix back art should open the correct side of the affected card.');
    closeModal();
  } else check(false, 'Order review should offer a direct Fix back art action.');
  click('#oZip');
  check($('#modalTitle')?.textContent === 'Review ZIP download' && $('#modal .bd').textContent.includes('3 left out'), 'ZIP review should show how many copies will be left out.');
  closeModal();
  deck().entries.splice(-2);
  renderOrder();

  const originalShareRequest = shareRequest, originalImageJsonBlob = imageJsonBlob, downloadDeckFile = download;
  const uploaded = await store.get('images',entry.faces[0].custom);
  let shareRequests = 0, packaged;
  try {
    shareRequest = async () => { shareRequests++; return {}; };
    imageJsonBlob = async (key, image) => {
      check(image.size === uploaded.size && image.type === uploaded.type, 'The deck file should include the original artwork.');
      return new Blob([JSON.stringify(key) + ':"data:image/png;base64,AA=="']);
    };
    download = blob => { packaged = blob; };
    await $('#printDeckOut').onclick();
    const data = packaged && JSON.parse(await packaged.text());
    check(shareRequests === 0 && data?.images?.[entry.faces[0].custom] && !data.originalShare, 'Downloading a deck file should embed artwork without creating a share.');
  } finally {
    shareRequest = originalShareRequest;
    imageJsonBlob = originalImageJsonBlob;
    download = downloadDeckFile;
  }
  closeModal();

  click('#btnSettings');
  const deckId = S.deckId, originalDeckCount = S.decks.length, originalBrightness = S.settings.brightness;
  const backupData = {app:'proxy-press',version:1,decks:[{id:deckId,name:'Backup fixture',entries:[]}],settings:{brightness:137},images:{}};
  const backupBlob = new Blob([JSON.stringify(backupData)],{type:'application/json'});
  await openPrintDeckFile(backupBlob,{fromBackup:true});
  check($('#modalTitle')?.textContent === 'Import backup' && $('#modal .bd').textContent.includes('1 deck') && S.decks.length === originalDeckCount, 'Project files should preview the backup before adding decks.');
  check($('#restoreBackupSettings') && !$('#restoreBackupSettings').checked, 'Backup settings should be opt-in.');
  closeModal();
  check($('#modalTitle')?.textContent === 'Project files' && S.decks.length === originalDeckCount, 'Closing the backup preview should return to project files and preserve existing decks.');
  await openPrintDeckFile(backupBlob,{fromBackup:true});
  if ($('#confirmBackupRestore')) {
    await $('#confirmBackupRestore').onclick();
    check(S.decks.length === originalDeckCount + 1 && S.decks.some(d=>d.id !== deckId && d.name === 'Backup fixture (imported)') && S.deckId === deckId, 'Importing a backup should add a copy and keep the current deck active.');
    check(S.settings.brightness === originalBrightness, 'Importing decks alone should keep the current print settings.');
  } else check(false, 'The backup preview should provide an explicit import action.');
  if ($('#modalTitle')?.textContent !== 'Project files') closeModal();
  await openPrintDeckFile(new Blob([JSON.stringify({...backupData,decks:[]})],{type:'application/json'}),{fromBackup:true});
  if ($('#confirmBackupRestore')) {
    $('#restoreBackupSettings').checked = true;
    await $('#confirmBackupRestore').onclick();
    check(S.settings.brightness === 137, 'Selecting the restore option should apply the backup print settings.');
  }
  if ($('#modalTitle')?.textContent !== 'Project files') closeModal();
  closeModal();

  deck().entries = [];
  renderAll();
  setWorkspaceView('proof');
  await drawPreview();
  check(visible('#orderQueueToggle'), 'The empty Order gallery should offer access to the queue.');
  click('#orderQueueToggle');
  if (innerWidth <= 820) {
    check(document.body.dataset.workspaceView === 'cards', 'The mobile gallery should return to Cards.');
  } else {
    await waitFor(()=>$('#orderQueueToggle')?.textContent === 'Show card list');
    check(visible('#orderQueueToggle'), 'Hiding the queue should leave its toggle visible.');
    click('#orderQueueToggle');
    check(!document.body.classList.contains('preview-focus'), 'The gallery toggle should restore the queue.');
  }

  if (failures.length) return {failures};
  console.log('PASS workspace flows: import, preview, print settings, artwork, order downloads, and project files');
  return true;
})()
