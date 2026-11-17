// Probe for tools/console-check.js --probe. Runs inside the page.
// Tests authoritative preflight, download blocking, calibration consistency across controls,
// custom paper identity, duplex setting preservation, and offline test sheet generation.
(async () => {
  const fails = [];
  const eq = (n, got, want) => { if (got !== want) fails.push(`${n}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); };

  const saved = {
    settings: JSON.parse(JSON.stringify(S.settings)),
    decks: JSON.parse(JSON.stringify(S.decks)),
    deckId: S.deckId,
    calProfiles: JSON.parse(JSON.stringify(S.calibrationProfiles)),
    printer: S.printer
  };

  const realJsPdf = window.jspdf.jsPDF;
  let lastPdfOutput = null;
  window.jspdf = Object.assign({}, window.jspdf, {
    jsPDF: function (...args) {
      const doc = new realJsPdf(...args);
      doc.save = (name) => { lastPdfOutput = { name, bytes: doc.output('arraybuffer') }; return doc; };
      return doc;
    }
  });

  try {
    // Setup a 4-card deck with local images
    const b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAIAAAA2iEnWAAAAEUlEQVR4nGP4z8DwnwGMERQARNAF+7BYSawAAAAASUVORK5CYII=';
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const artKey = 'probe-test-art-key';
    await store.set('images', artKey, new Blob([bytes], {type:'image/png'}));
    blobUrls.set(artKey, URL.createObjectURL(new Blob([bytes], {type:'image/png'})));

    const testDeck = {
      id: 'probe-preflight-deck',
      name: 'Preflight Deck',
      entries: [
        { uid: 'c1', name: 'Card 1', qty: 2, faces: [{name:'Card 1', custom:artKey}], tokens: [] },
        { uid: 'c2', name: 'Card 2', qty: 2, faces: [{name:'Card 2', custom:artKey}], tokens: [] }
      ],
      cardback: null
    };
    S.decks = [testDeck];
    S.deckId = testDeck.id;
    save();

    // -------------------------------------------------------------
    // PART 1: Preflight checks and 5x2 upright grid blocking
    // -------------------------------------------------------------
    // Configure invalid 5x2 upright grid on landscape Letter
    S.settings = cleanSettings({
      ...DEFAULTS,
      pageSize: 'letter',
      orientation: 'landscape',
      cols: 5,
      rows: 2,
      cardRotation: 'upright',
      cardW: 63,
      cardH: 88,
      bleed: 2,
      margin: 4
    });
    renderAll();
    renderGuideTab();

    const badPreflight = await runPreflight({settings: S.settings, deck: testDeck});
    eq('5x2 upright on landscape Letter is invalid', badPreflight.valid, false);
    const clipErr = badPreflight.errors.find(e => e.type === 'trim_clip');
    eq('5x2 upright has trim_clip error', !!clipErr, true);
    eq('clip error specifies sheet 1', clipErr?.sheet, 1);

    // Verify download buttons are blocked
    await renderGuideTab();
    const btnTab = document.querySelector('#btnExportPdfTab');
    eq('export tab download button disabled for clipped layout', btnTab?.disabled, true);

    lastPdfOutput = null;
    await exportPDF(true);
    eq('exportPDF blocked: no PDF produced for clipped layout', lastPdfOutput, null);

    // Configure valid 4x2 layout on landscape Letter
    S.settings = cleanSettings({
      ...DEFAULTS,
      pageSize: 'letter',
      orientation: 'landscape',
      cols: 4,
      rows: 2,
      cardRotation: 'auto',
      cardW: 63,
      cardH: 88,
      bleed: 2,
      margin: 4
    });
    renderAll();
    await renderGuideTab();

    const goodPreflight = await runPreflight({settings: S.settings, deck: testDeck});
    eq('4x2 landscape Letter is valid', goodPreflight.valid, true);
    eq('export tab download button enabled for valid layout', btnTab?.disabled, false);

    lastPdfOutput = null;
    await exportPDF(true);
    eq('exportPDF produces valid PDF for valid layout', !!lastPdfOutput, true);
    eq('exported PDF filename', lastPdfOutput?.name, 'Preflight Deck.pdf');

    // Cameo registration mark conflict preflight
    S.settings.silhouette = true;
    const oldInset = S.settings.regInset;
    S.settings.regInset = Math.max(layout().x0,layout().y0)+2; // put the square inside an occupied card
    const cameoPreflight = await runPreflight({settings: S.settings, deck: testDeck});
    eq('Cameo registration mark conflict blocked', cameoPreflight.errors.some(e => e.type === 'reg_conflict'), true);
    S.settings.silhouette = false;
    S.settings.regInset = oldInset;
    S.settings.margin = 4;

    // Missing artwork preflight
    const deckWithMissing = {
      id: 'probe-missing-art',
      name: 'Missing Art Deck',
      entries: [{ uid: 'm1', name: 'Ghost Card', qty: 1, faces: [{name:'Ghost Card', custom:'non-existent-key'}], tokens: [] }]
    };
    const missingPreflight = await runPreflight({settings: S.settings, deck: deckWithMissing});
    eq('missing artwork is blocked', missingPreflight.errors.some(e => e.type === 'missing_art'), true);

    // -------------------------------------------------------------
    // PART 2: Calibration consistency and asymmetric values
    // -------------------------------------------------------------
    // Asymmetric offset test: landscape (1.0, 0.5) -> portrait (-0.5, 1.0)
    const turnTest = turnOffsets('portrait', 1.0, 0.5);
    eq('asymmetric offset turn X', turnTest.x, -0.5);
    eq('asymmetric offset turn Y', turnTest.y, 1.0);
    const turnBackTest = turnOffsets('landscape', -0.5, 1.0);
    eq('asymmetric offset turn-back X', turnBackTest.x, 1.0);
    eq('asymmetric offset turn-back Y', turnBackTest.y, 0.5);

    // Profile with exact measurements for landscape and portrait
    const calProf = {
      id: 'cal-test-prof',
      name: 'Precision Stock',
      printer: S.printer,
      settings: {
        'letter/landscape': {
          offsetX: 1.0, offsetY: 0.5, scaleX: 100.2, scaleY: 100.1,
          backOffsetX: -1.5, backOffsetY: -0.8,
          duplexFlip: 'long'
        },
        'letter/portrait': {
          offsetX: 2.0, offsetY: 3.0, scaleX: 99.8, scaleY: 99.9,
          backOffsetX: 0.5, backOffsetY: 0.6,
          duplexFlip: 'short'
        }
      }
    };
    S.calibrationProfiles = [calProf];
    renderCalibrationProfiles(calProf.id);

    // Apply profile
    applyCalProfile(calProf);
    eq('landscape exact offsetX loaded', S.settings.offsetX, 1.0);
    eq('landscape exact offsetY loaded', S.settings.offsetY, 0.5);
    eq('proof calibration status is Measured', getCalibrationStatus(S.settings).status, 'Measured');

    // Switch orientation via preset
    const portPreset = {
      id: 'test-port-preset',
      name: 'Test Portrait Preset',
      builtin: true,
      settings: { pageSize: 'letter', orientation: 'portrait' }
    };
    applyPreset(portPreset);
    eq('preset switch loads exact portrait measurement offsetX', S.settings.offsetX, 2.0);
    eq('preset switch loads exact portrait measurement offsetY', S.settings.offsetY, 3.0);
    eq('proof status after preset switch is Measured', getCalibrationStatus(S.settings).status, 'Measured');

    // Switch back via preset
    const landPreset = {
      id: 'test-land-preset',
      name: 'Test Landscape Preset',
      builtin: true,
      settings: { pageSize: 'letter', orientation: 'landscape' }
    };
    applyPreset(landPreset);
    eq('preset switch back loads exact landscape offsetX', S.settings.offsetX, 1.0);
    eq('preset switch back loads exact landscape offsetY', S.settings.offsetY, 0.5);

    // Profile with ONLY landscape measurement: portrait must be Estimated
    const landOnlyProf = {
      id: 'cal-land-only',
      name: 'Landscape Only',
      printer: S.printer,
      settings: {
        'letter/landscape': {
          offsetX: 1.0, offsetY: 0.5, scaleX: 100, scaleY: 100,
          backOffsetX: -2.0, backOffsetY: -1.0, duplexFlip: 'long'
        }
      }
    };
    S.calibrationProfiles = [landOnlyProf];
    renderCalibrationProfiles(landOnlyProf.id);
    applyCalProfile(landOnlyProf);

    // Switch to portrait with land-only profile
    applyPreset(portPreset);
    eq('turned portrait offsetX is -0.5', S.settings.offsetX, -0.5);
    eq('turned portrait offsetY is 1.0', S.settings.offsetY, 1.0);
    const estStat = getCalibrationStatus(S.settings);
    eq('turned portrait status is Estimated', estStat.status, 'Estimated');

    // -------------------------------------------------------------
    // PART 3: Custom paper dimensions identity
    // -------------------------------------------------------------
    const customSheetA = { pageSize: 'custom', pageW: 200, pageH: 300, orientation: 'portrait' };
    const customSheetB = { pageSize: 'custom', pageW: 150, pageH: 250, orientation: 'portrait' };
    eq('custom sheet A key includes dimensions', calSlotKey(customSheetA), 'custom:200x300/portrait');
    eq('custom sheet B key includes dimensions', calSlotKey(customSheetB), 'custom:150x250/portrait');
    eq('custom sheet keys do not overwrite each other', calSlotKey(customSheetA) !== calSlotKey(customSheetB), true);
    eq('custom sheet name formats dimensions', calSlotName(calSlotKey(customSheetA)), 'Custom 200×300 mm portrait');

    // -------------------------------------------------------------
    // PART 4: Duplex feed & flip edge preservation
    // -------------------------------------------------------------
    const dupTestProf = {
      id: 'cal-dup-test',
      name: 'Duplex Preserved',
      printer: S.printer,
      settings: {}
    };
    S.calibrationProfiles = [dupTestProf];
    renderCalibrationProfiles(dupTestProf.id);

    // Save setup 1: Manual flip, long edge
    S.settings.pageSize = 'letter';
    S.settings.orientation = 'landscape';
    S.settings.duplexMethod = 'manual';
    S.settings.duplexFlip = 'long';
    S.settings.backOffsetX = -2.5;
    S.settings.backOffsetY = -1.2;
    document.querySelector('#calProfileName').value = 'Duplex Preserved';
    document.querySelector('#calProfileSave').click();

    // Save setup 2: Auto duplex, short edge on same sheet
    S.settings.duplexMethod = 'auto';
    S.settings.duplexFlip = 'short';
    S.settings.backOffsetX = 1.8;
    S.settings.backOffsetY = 0.9;
    document.querySelector('#calProfileSave').click();

    // Now test retrieval for both setups from the same profile slot
    const slotManual = calSlotFor(dupTestProf, {pageSize:'letter', orientation:'landscape', duplexMethod:'manual', duplexFlip:'long'});
    const slotAuto = calSlotFor(dupTestProf, {pageSize:'letter', orientation:'landscape', duplexMethod:'auto', duplexFlip:'short'});
    eq('manual long edge duplex offset X preserved', slotManual.set.backOffsetX, -2.5);
    eq('manual long edge duplex offset Y preserved', slotManual.set.backOffsetY, -1.2);
    eq('auto short edge duplex offset X preserved', slotAuto.set.backOffsetX, 1.8);
    eq('auto short edge duplex offset Y preserved', slotAuto.set.backOffsetY, 0.9);

    // -------------------------------------------------------------
    // PART 5: Offline test sheets generation
    // -------------------------------------------------------------
    lastPdfOutput = null;
    document.querySelector('#btnCal').click();
    await sleep(20);
    eq('alignment sheet generates offline', !!lastPdfOutput, true);
    eq('alignment sheet filename', lastPdfOutput?.name, 'alignment-sheet.pdf');

    lastPdfOutput = null;
    document.querySelector('#btnDuplexTest').click();
    await sleep(20);
    eq('duplex test sheet generates offline', !!lastPdfOutput, true);
    eq('duplex test sheet filename', lastPdfOutput?.name, 'double-sided-test.pdf');

  } catch (err) {
    fails.push('threw: ' + (err && err.message));
  } finally {
    window.jspdf = Object.assign({}, window.jspdf, {jsPDF: realJsPdf});
    S.settings = saved.settings;
    S.decks = saved.decks;
    S.deckId = saved.deckId;
    S.calibrationProfiles = saved.calProfiles;
    S.printer = saved.printer;
    save();
    try { renderAll(); } catch {}
  }

  return fails.length ? {fails} : true;
})();
