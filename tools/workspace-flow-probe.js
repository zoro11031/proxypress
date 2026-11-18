// Run with node tools/console-check.js --offline-fixtures --probe tools/workspace-flow-probe.js
// Repeat with --width 390 to exercise the mobile queue and settings.
(async () => {
  const failures = [];
  const check = (condition, message) => { if (!condition) failures.push(message); };
  const waitFor = async predicate => {
    for (let attempt = 0; attempt < 50; attempt++) {
      if (predicate()) return true;
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
  console.log('PASS workspace flows: import, settings, sheet scope, review return, and Order queue');
  return true;
})()
