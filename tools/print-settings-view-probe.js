(async () => {
  const original = structuredClone(S);
  const Real = window.jspdf.jsPDF;
  const oldConfirm = window.confirm;
  const failed = [];
  const outputs = [];
  const check = (name, cond) => { if (!cond) failed.push(name); };
  const near = (a, b) => Math.abs(a - b) < 0.0001;

  try {
    S.welcomed = true;
    closeModal(true);
    S.mode = 'print';
    S.calibrationProfiles = [];
    S.calibrationProfileId = null;
    window.confirm = () => false;
    applyMode();

    // 1. Proof toolbar check: Persistent Estimated alignment badge must not exist
    check('no persistent proofCalBadge on proof toolbar', $('#proofCalBadge') === null);

    // 2. All five pages are available in the dedicated settings editor.
    openPrintSettings('layout');
    const entrypoints = ['layout', 'printer', 'alignment', 'color', 'cutting'];

    // Test tab navigation inside #printSettingsView
    for (const page of entrypoints) {
      $(`#tabNav-${page}`)?.click();
      check(`tab nav landed on ${page}`, $(`#settingsPage-${page}`).style.display !== 'none');
      check(`tab nav button ${page} has active class`, $(`#tabNav-${page}`).classList.contains('active'));
    }

    // 3. Back to proof restores view, activeSheet, side, selection, zoom, and opener focus
    backToProof();
    const testEntry = { uid: 'c1', name: 'Test Card', qty: 1, faces: [{ name: 'Front' }] };
    deck().entries = [testEntry];
    const testCopyKey = copyKey(testEntry, 0);
    selectedCopies = new Set([testCopyKey]);
    S.activeSheet = 0;
    S.showBacks = false;
    S.zoom = 125;
    S.zoomMode = 'manual';
    openPrintSettings('alignment', $('#inspCal'));
    check('settings view open', document.body.classList.contains('print-settings-active'));
    $('#btnBackToProof')?.click();
    check('settings view closed by Back to proof', !document.body.classList.contains('print-settings-active'));
    check('proof activeSheet restored', S.activeSheet === 0);
    check('proof showBacks restored', S.showBacks === false);
    check('proof selectedCopies restored', selectedCopies.has(testCopyKey));
    check('proof zoom restored', S.zoom === 125);

    // 4. Decoupled alignment input and explicit apply
    openPrintSettings('alignment');
    const inputX = $('#input-offsetX');
    check('found alignment input offsetX', !!inputX);

    // Test typing invalid value
    inputX.value = ''; inputX.dispatchEvent(new Event('input', {bubbles: true}));
    $('#btnApplyAlignment')?.click();
    check('invalid input shows error message', $('#alignmentInputError').style.display !== 'none');
    check('invalid input does not mutate S.settings', S.settings.offsetX === 0);

    // Test entering 1.25 mm without clicking Apply
    inputX.value = '1.25'; inputX.dispatchEvent(new Event('input', {bubbles: true}));
    check('typing 1.25 does not immediately mutate S.settings', S.settings.offsetX === 0);

    // Click Apply changes
    $('#btnApplyAlignment')?.click();
    check('apply changes updates S.settings.offsetX to 1.25', S.settings.offsetX === 1.25);
    check('alignment input error is hidden', $('#alignmentInputError').style.display === 'none');

    // Check status on Alignment page and inspector
    const calStat = getCalibrationStatus();
    check('front status is Manual after explicit entry', calStat.front.status === 'Manual');
    check('front label is Manual alignment applied', calStat.front.label === 'Manual alignment applied');
    check('front source is Entered alignment', calStat.front.source === 'Entered alignment');

    // Check active setup card in Alignment page
    refreshAlignmentPage();
    check('alignmentActiveCard front banner reflects 1.25 mm', $('#alignFrontValuesText').textContent.includes('1.25 mm'));

    // 5. Verify PDF export shifts front image by exactly 1.25 mm
    const c = document.createElement('canvas');
    c.width = 630;
    c.height = 880;
    c.getContext('2d').fillRect(0, 0, 630, 880);
    const key = await storeImage(await new Promise(r => c.toBlob(r)));
    deck().entries = [{ uid: uid(), name: 'Test Card', qty: 1, faces: [{ name: 'Front', custom: key }] }];
    deck().calibrationState = {};
    S.settings = cleanSettings({
      ...DEFAULTS,
      pageSize: 'letter',
      orientation: 'landscape',
      cols: 4,
      rows: 2,
      backs: false,
      dfcMode: 'single',
      dpi: 100,
      offsetX: 0,
      offsetY: 0
    });
    renderAll();

    // Baseline export with 0 offset
    window.jspdf = {
      ...window.jspdf,
      jsPDF: function(...args) {
        const doc = new Real(...args), images = [], add = doc.addImage.bind(doc);
        doc.addImage = (data, format, x, y, ...rest) => {
          images.push({ x, y });
          return add(data, format, x, y, ...rest);
        };
        doc.save = () => outputs.push({ images, pdf: doc.output('datauristring') });
        return doc;
      }
    };
    $('#exportScope').value = 'all';
    await exportPDF(true);
    const baseExport = outputs[0];

    // Now apply 1.25 mm
    openPrintSettings('alignment');
    $('#input-offsetX').value = '1.25'; $('#input-offsetX').dispatchEvent(new Event('input', {bubbles: true}));
    $('#btnApplyAlignment').click();
    await exportPDF(true);
    const appliedExport = outputs[1];
    check('baseExport and appliedExport captured', !!baseExport && !!appliedExport);
    const shiftX = appliedExport.images[0].x - baseExport.images[0].x;
    check('export PDF shifted front image by exactly 1.25 mm', near(shiftX, 1.25));

    // 6. Single-sided job test:
    const singleStat = getCalibrationStatus();
    check('single-sided job hasBacks is false', singleStat.hasBacks === false);
    check('single-sided status has no Back in label', !singleStat.label.includes('Back:'));
    check('single-sided active card shows single-sided job', $('#alignDuplexMode').textContent.includes('Single-sided'));

    // 7. Duplex job test:
    deck().entries[0].faces.push({ name: 'Back', custom: key });
    S.settings.backs = true;
    S.settings.dfcMode = 'duplex';
    renderAll();
    refreshAlignmentPage();
    const duplexStat = getCalibrationStatus();
    check('duplex job hasBacks is true', duplexStat.hasBacks === true);
    check('duplex active card shows duplex', !$('#alignDuplexMode').textContent.includes('Single-sided'));
    check('duplex active card shows back banner', $('#alignBackSourceBadge').textContent.length > 0);

    // 8. Back-only profile test:
    const mf753Profile = BUILTIN_CAL_PROFILES.find(p => p.id === 'c-mf753-auto');
    check('found c-mf753-auto profile', !!mf753Profile);
    applyCalProfile(mf753Profile);
    check('front offset preserved after back-only profile', S.settings.offsetX === 1.25);
    check('back offset loaded from profile', S.settings.backOffsetY === 1);
    const afterProfileStat = getCalibrationStatus();
    check('front did NOT get credit from back-only profile', afterProfileStat.front.status === 'Manual');
    check('front source is not profile name', afterProfileStat.front.source === 'Entered alignment');

    // 9. Saving profile test:
    $('#calProfileName').value = 'Test Custom Profile';
    $('#calProfileSave').click();
    const savedStat = getCalibrationStatus();
    check('saved profile reports Saved profile', savedStat.front.status === 'Saved' || savedStat.front.label.includes('Saved profile') || savedStat.label.includes('Saved profile'));

    // 10. Review warning linking to Alignment:
    S.calibrationProfileId = null;
    deck().calibrationState = {
      front: { kind: 'manual', scope: JSON.stringify(['dummy', 'other/landscape']), values: { offsetX: 5, offsetY: 0, scaleX: 100, scaleY: 100, printRotate: 0 } }
    };
    S.settings.offsetX = 5;
    const preWarn = await runPreflight({ settings: S.settings, deck: deck(), printer: S.printer });
    const calWarn = preWarn.warnings.find(w => w.type === 'cal_estimated_front');
    check('review emits specific cal_estimated_front warning', !!calWarn);
    check('review warning tab is alignment', calWarn?.tab === 'alignment');
    check('review warning side is front', calWarn?.side === 'front');

    window.__probeArtifacts = { outputs };
    return failed.length ? { failed } : true;
  } catch (err) {
    return { failed: [...failed, err.stack || err.message] };
  } finally {
    window.confirm = oldConfirm;
    window.jspdf = { ...window.jspdf, jsPDF: Real };
    Object.assign(S, original);
    closeModal(true);
    save();
    applyMode();
    renderAll();
  }
})();
