// Acceptance check probe for the workspace redesign, art picker comparison view,
// sequential issue fixing, copy selection persistence, foil tone model, and test sheet export.
(async () => {
  const originalS = JSON.parse(JSON.stringify(S));
  const fails = [];
  const eq = (name, got, want) => {
    if (JSON.stringify(got) !== JSON.stringify(want)) fails.push(`${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
  };

  try {
    // 1. Setup multi-sheet Commander fixture:
    // Repeated copies (4 Llanowar Elves), DFC missing back (Delver of Secrets), Token (Treasure),
    // and single cards filling up to 19 total cards (3 sheets on 8-per-sheet layout: 8, 8, 3).
    const dummyCvs = document.createElement('canvas'); dummyCvs.width = 630; dummyCvs.height = 880;
    const samplePng = dummyCvs.toDataURL();
    const d = deck();
    d.entries = [
      {
        uid: 'dfc1',
        name: 'Delver of Secrets // Insectile Aberration',
        qty: 1,
        faces: [
          { name: 'Delver of Secrets', png: samplePng, normal: samplePng, drive: 'drv-delver', mpcDpi: 800 },
          { name: 'Insectile Aberration' } // Missing back artwork!
        ]
      },
      {
        uid: 'elves1',
        name: 'Llanowar Elves',
        qty: 4,
        faces: [{ name: 'Llanowar Elves', png: samplePng, normal: samplePng, drive: 'drv-elves', mpcDpi: 600 }]
      },
      {
        uid: 'tok1',
        name: 'Treasure Token',
        kind: 'TOKEN',
        qty: 1,
        faces: [{ name: 'Treasure Token', png: samplePng, normal: samplePng, drive: 'drv-treasure', mpcDpi: 600 }]
      }
    ];
    // Add 13 single cards to reach 19 cards total (8 on sheet 1, 8 on sheet 2, 3 on sheet 3)
    for (let i = 1; i <= 13; i++) {
      d.entries.push({
        uid: `c_extra_${i}`,
        name: `Commander Card ${i}`,
        qty: 1,
        faces: [{ name: `Commander Card ${i}`, png: samplePng, normal: samplePng, drive: `drv-${i}`, mpcDpi: 600 }]
      });
    }

    // Configure Letter Landscape (4x2 = 8 cards per sheet)
    S.settings.pageSize = 'letter';
    S.settings.orientation = 'landscape';
    S.settings.cols = 4;
    S.settings.rows = 2;
    S.settings.backs = false; // Normal cards single-sided, but DFC has back
    S.settings.dfcMode = 'duplex';

    // Start on middle sheet (Sheet 2 of 3), zoom 2.0
    S.activeSheet = 1;
    S.zoom = 2.0;
    S.proofSide = 'front';
    S.showBacks = false;

    renderAll();
    await drawPreview();

    const slots = buildSlots();
    const pages = paginate(slots, layout().per);
    eq('total card slots is 19', slots.length, 19);
    eq('total sheets is 3', pages.length, 3);
    eq('last sheet has 3 cards (partially filled)', pages[2].length, 3);
    eq('proof sheet label displays Sheet 2 of 3', $('#proofSheetLabel').textContent, 'Sheet 2 of 3');

    // 2. Verify "Needs attention" filtering and issue detection
    const issues = getPrintJobIssues();
    eq('detects missing back on Delver of Secrets', issues.some(iss => iss.uid === 'dfc1' && iss.type === 'missing_back'), true);
    eq('single-faced cards with backs disabled stay out of correction queue', issues.filter(iss => iss.uid !== 'dfc1').length, 0);

    // Toggle Needs attention filter
    const btnNeedsArt = $('#btnFilterNeedsArt');
    eq('needs attention button present in queue header', !!btnNeedsArt, true);
    btnNeedsArt.click();
    eq('filterNeedsArt enabled', S.filterNeedsArt, true);
    applyDeckFilter();

    const visibleRows = $$('#cardList .card').filter(r => !r.hidden);
    eq('only card with issues visible when filtered', visibleRows.length, 1);
    eq('visible card is Delver of Secrets', visibleRows[0].dataset.uid, 'dfc1');

    const issueBadge = visibleRows[0].querySelector('.queue-issue-badge.missing_back');
    eq('issue badge displays Missing back', !!issueBadge && issueBadge.textContent, 'Missing back');

    // 3. Sequential issue routing:
    // Click issue badge to navigate to the card and open the art picker
    issueBadge.click();

    // Check that art picker modal opened in comparison view
    const modalBd = $('#modal .bd');
    eq('art picker modal opened', !!modalBd, true);
    eq('modal header specifies editing Back (Insectile Aberration)', $('#modal .hd b').textContent.includes('Back (Insectile Aberration)'), true);
    eq('issue banner displayed in art picker', !!$('#pickerIssueBar', modalBd), true);
    eq('issue banner label mentions Missing back', $('#pickerIssueLabel', modalBd).textContent.includes('Missing back'), true);

    // Verify Comparison View structure
    eq('comparison grid exists', !!$('#cmpGrid', modalBd), true);
    eq('current artwork column exists', !!$('.current-col', modalBd), true);
    eq('candidate column exists', !!$('.candidate-col', modalBd), true);
    eq('apply button exists in candidate column', !!$('#btnApplyCandidate', modalBd), true);

    // Verify source navigation tabs
    const srcTabs = $$('.source-nav-tabs button', modalBd);
    eq('source tabs rendered (Printings, Community, Local)', srcTabs.length, 3);

    // Apply art to Delver's back
    const dfcEntry = d.entries.find(e => e.uid === 'dfc1');
    dfcEntry.faces[1] = {
      name: 'Insectile Aberration',
      png: samplePng,
      normal: samplePng,
      drive: 'drv-delver-back',
      mpcDpi: 800,
      manual: true
    };
    closeModal();
    save();
    renderAll();
    await drawPreview();

    // Verify issue resolved
    const issuesAfterFix = getPrintJobIssues();
    eq('issues cleared after fixing Delver back', issuesAfterFix.length, 0);

    // Turn off filter
    btnNeedsArt.click();
    applyDeckFilter();

    // 4. Duplicate copy art change & entry splitting
    // Llanowar Elves initially has qty: 4 in one entry
    const elvesBefore = d.entries.find(e => e.uid === 'elves1');
    eq('elves entry has qty 4', elvesBefore.qty, 4);

    // Target copy 0 specifically
    const targetCopy = {
      e: elvesBefore,
      i: 0,
      copies: [{ uid: 'elves1', copies: [0] }],
      deckId: S.deckId
    };

    const sheetBefore = S.activeSheet;
    const zoomBefore = S.zoom;

    // Apply custom art to this single copy
    await applyArtChoice(targetCopy, 0, f => {
      f.png = samplePng;
      f.normal = samplePng;
      f.scryArt = 'https://cards.scryfall.io/alt-elves.jpg';
      f.manual = true;
    });

    // Check that entry split cleanly
    const elvesEntries = d.entries.filter(e => e.name === 'Llanowar Elves');
    eq('elves split into multiple entries', elvesEntries.length > 1, true);
    const editedEntry = elvesEntries.find(e => e.faces[0].scryArt?.includes('alt-elves.jpg'));
    const uneditedEntry = elvesEntries.find(e => !e.faces[0].scryArt?.includes('alt-elves.jpg'));
    eq('edited copy has new artwork', !!editedEntry && editedEntry.qty, 1);
    eq('other copies kept original artwork', !!uneditedEntry && uneditedEntry.qty, 3);

    // Verify copy selection was remapped to the edited entry
    eq('selection is preserved on edited copy', selectedCopies.has(copyKey(editedEntry, 0)), true);

    // Verify sheet, side, and zoom were preserved
    eq('activeSheet preserved after art change', S.activeSheet, sheetBefore);
    eq('zoom preserved after art change', S.zoom, zoomBefore);

    // 5. Verify autofill preserves manually chosen artwork
    const autoResult = await mpcAutofill({ auto: true });
    const editedAfterAutofill = d.entries.find(e => e.uid === editedEntry.uid);
    eq('autofill did not overwrite manually chosen art', editedAfterAutofill.faces[0].scryArt, 'https://cards.scryfall.io/alt-elves.jpg');

    // 6. Verify Foil Tone Model & Simulation Controls
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = 100;
    sampleCanvas.height = 100;
    const sCtx = sampleCanvas.getContext('2d');
    sCtx.fillStyle = '#808080';
    sCtx.fillRect(0, 0, 100, 100);

    const foilSim = applyFoilToneModel(sampleCanvas, { midtone: 1.3, shadow: 0.85, satLoss: 0.75, reflection: false });
    eq('applyFoilToneModel returns valid canvas', foilSim instanceof HTMLCanvasElement, true);
    eq('applyFoilToneModel preserves dimensions', foilSim.width === 100 && foilSim.height === 100, true);

    // Verify modal opens with simulation
    await openFoilToneModal();
    const foilBd = $('#modal .bd');
    eq('foil preview modal opened', !!foilBd, true);
    eq('estimated foil tone badge displayed', !!$('.readiness-badge.warnings', foilBd), true);
    eq('brightness slider present in foil modal', !!$('#foilBri', foilBd), true);
    eq('saturation slider present in foil modal', !!$('#foilSat', foilBd), true);
    eq('contrast slider present in foil modal', !!$('#foilCon', foilBd), true);
    eq('simulation midtone slider present', !!$('#simMidtone', foilBd), true);
    eq('show reflection toggle present', !!$('#simReflection', foilBd), true);
    closeModal();

    // 7. Verify Print at home vs Order prints mode
    S.mode = 'order';
    renderAll();
    await drawPreview();
    eq('order gallery renders in order mode', !!$('#pages .gal'), true);
    S.mode = 'print';
    renderAll();
    await drawPreview();
    eq('pages renders sheet in print mode', !!$('#pages .pg'), true);

    if (fails.length) return { failed: fails };
    return true;
  } catch (err) {
    return { failed: [`Unexpected error: ${err.message}\n${err.stack}`] };
  } finally {
    Object.assign(S, originalS);
  }
})();
