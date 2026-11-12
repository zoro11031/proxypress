// Probe for tools/console-check.js --probe. Runs inside the page.
// Returns true, or an object naming what did not match (which fails the run).
//
// Covers the layout facts that have actually gone wrong: which way the sheet has to
// be turned for a given layout, whether the printer offset reaches the back pages,
// whether the margin guides stop short of the sheet edge, and whether the
// unfeedable-paper warning fires for the printer it is scoped to and stays quiet
// for printers we have no sheet list for.
(() => {
  const fails = [];
  const eq = (name, got, want) => { if (got !== want) fails.push(`${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); };
  const saved = S.settings;
  try {
    // A landscape page prints sideways on short-edge-fed paper, so the turn is
    // top-to-bottom of the picture and the back art is rotated 180.
    S.settings = {...DEFAULTS, pageSize:'letter', orientation:'landscape', cardRotation:'upright', bleed:2, margin:5, dfcMode:'duplex'};
    let L = layout();
    eq('landscape mirrorX', L.mirrorX, false);
    eq('landscape turn', duplexTurn(L).axis, 'top to bottom');
    eq('landscape back rotation', faceRot(L, true), 180);
    eq('landscape manual steps', /top to bottom/.test(backStepsHtml(1)), true);
    S.settings.duplexMethod = 'auto';
    eq('landscape auto steps', /top to bottom/.test(backStepsHtml(1)), true);
    S.settings.duplexFlip = 'short';
    L = layout();
    eq('landscape short mirrorX', L.mirrorX, true);
    eq('landscape short turn', duplexTurn(L).axis, 'left to right');
    eq('landscape short back rotation', faceRot(L, true), 0);
    eq('landscape short left feed', duplexFeedInstruction(L, 'left').back, 'right short edge');

    // Portrait is the other way round.
    S.settings = {...DEFAULTS, pageSize:'letter', orientation:'portrait', cardRotation:'auto', bleed:0.5, margin:5, dfcMode:'duplex'};
    L = layout();
    eq('portrait mirrorX', L.mirrorX, true);
    eq('portrait turn', duplexTurn(L).axis, 'left to right');
    eq('portrait back rotation', faceRot(L, true), 0);
    eq('portrait manual steps', /left to right/.test(backStepsHtml(1)), true);
    S.settings.duplexFlip = 'short';
    L = layout();
    eq('portrait short mirrorX', L.mirrorX, false);
    eq('portrait short turn', duplexTurn(L).axis, 'top to bottom');
    eq('portrait short back rotation', faceRot(L, true), 180);
    eq('portrait short top feed', duplexFeedInstruction(L, 'top').back, 'bottom short edge');
    eq('MPC uploaded bleed default', cleanSettings({}).customSrcBleed, 3.048);

    // The printer offset reaches both sides; the back offset is a delta on top.
    // A pre-change saved setting measured the back absolutely and must land in
    // the same place after migration.
    S.settings = cleanSettings({offsetX:-1, backOffsetX:-1.4});
    eq('migrated back offset', S.settings.backOffsetX, -0.4);
    eq('fronts image at', makeT(layout(), false).x(0), -1);
    eq('backs image at', makeT(layout(), true).x(0), -1.4);
    // A back offset of 0 meant "never calibrated" and must follow the front.
    S.settings = cleanSettings({offsetX:-1, backOffsetX:0});
    eq('uncalibrated back follows front', makeT(layout(), true).x(0), -1);
    S.settings = cleanSettings({...DEFAULTS, backScaleX:101, backScaleY:99});
    const frontT = makeT(layout(), false), backT = makeT(layout(), true);
    eq('front scale remains independent', frontT.w(10), 10);
    eq('back scale X applies only to backs', backT.w(10), 10.1);
    eq('back scale Y applies only to backs', backT.h(10), 9.9);
    eq('back offset unit migration', cleanSettings({backOffsetUnit:'in'}).backOffsetUnit, 'in');

    // Margin guides must stop short of the sheet edge. A printer's full-bleed mode
    // relaxes its declared margin without promising ink at 0.0 mm, so a guide drawn
    // to 0 ends where nobody has measured.
    S.settings = {...DEFAULTS, pageSize:'letter', orientation:'portrait', guides:'margin', bleed:1, margin:4};
    const L2 = layout(), g = guideLines(L2, L2.per);
    const nearest = Math.min(...g.flatMap(([a, b, c, d]) => [a, b, c, d, L2.W - a, L2.H - b, L2.W - c, L2.H - d]));
    if (!(nearest >= 0.5)) fails.push(`margin guides reach ${nearest.toFixed(2)}mm from the sheet edge, want >= 0.5`);

    // The unfeedable-paper warning. All three branches, because a warning that
    // cannot fire and a warning that fires always both read as working: the
    // default printer has no sheet list and the default paper is feedable, so
    // neither is exercised by simply loading the page.
    const savedPrinter = S.printer;
    const warned = (printer, pageSize) => {
      S.printer = printer;
      S.settings = {...DEFAULTS, pageSize};
      renderSettings();
      return /can't feed this paper size/.test(document.querySelector('#settingsForm').innerHTML);
    };
    eq('warns: canon + tabloid', warned('mf753', 'tabloid'), true);
    eq('quiet: canon + letter', warned('mf753', 'letter'), false);
    eq('quiet: canon + a6 (newly added)', warned('mf753', 'a6'), false);
    eq('quiet: unknown printer + tabloid', warned('et2800', 'tabloid'), false);
    S.printer = savedPrinter;

    // Which edge leads on the second pass. Turning the sheet mirrors one axis and
    // leaves the other alone, so the edge only changes when it lies on the mirrored
    // axis. Deciding it from the flip setting alone - short edge means "feed the
    // opposite edge" - is right for the edge a short-edge-feeding printer actually
    // takes and wrong for the other two, which is why both are checked here.
    const feedCase = (orientation, flip, edge) => {
      S.settings = {...DEFAULTS, pageSize:'letter', orientation, duplexFlip:flip, cardRotation:'upright', bleed:1, margin:5};
      return backFeedEdge(layout(), edge);
    };
    eq('portrait long, top in first', feedCase('portrait', 'long', 'top'), 'top');
    eq('portrait long, left in first', feedCase('portrait', 'long', 'left'), 'right');
    eq('portrait short, top in first', feedCase('portrait', 'short', 'top'), 'bottom');
    eq('portrait short, left in first', feedCase('portrait', 'short', 'left'), 'left');
    eq('landscape long, left in first', feedCase('landscape', 'long', 'left'), 'left');
    eq('landscape long, top in first', feedCase('landscape', 'long', 'top'), 'bottom');
    eq('landscape short, left in first', feedCase('landscape', 'short', 'left'), 'right');
    eq('landscape short, top in first', feedCase('landscape', 'short', 'top'), 'top');

    // The double-sided test's reading rule, which is the whole reason the sheet can
    // ask for a number instead of a sign. The mark sits at the page centre on the
    // front; the grid sits where that point lands on the back. Read in the back
    // page's own coordinates, the offset between them is exactly the correction to
    // ADD to the back-page offset - on both axes, for either flip, and whatever the
    // back-page scale is, because the centre is the one point scaling cannot move.
    // Measured from the front instead, the two axes would need opposite signs.
    const gridReading = () => {
      const L3 = layout(), Tf = makeT(L3, false), Tb = makeT(L3, true), c = {x:L3.W / 2, y:L3.H / 2};
      const hole = backPoint(L3, {x:Tf.x(c.x), y:Tf.y(c.y)}), g = backPoint(L3, c);
      return {x: +(hole.x - Tb.x(g.x)).toFixed(4), y: +(hole.y - Tb.y(g.y)).toFixed(4)};
    };
    for (const orientation of ['portrait', 'landscape']) for (const flip of ['long', 'short']) {
      S.settings = {...DEFAULTS, pageSize:'letter', orientation, duplexFlip:flip, cardRotation:'upright', bleed:1, margin:5,
        backOffsetX:0.7, backOffsetY:-0.4, backScaleX:103, backScaleY:97};
      const r = gridReading();
      eq(`${orientation} ${flip} reading X`, r.x, -0.7);
      eq(`${orientation} ${flip} reading Y`, r.y, 0.4);
      S.settings.backOffsetX += r.x; S.settings.backOffsetY += r.y;
      const after = gridReading();
      eq(`${orientation} ${flip} reading clears`, `${after.x},${after.y}`, '0,0');
    }
    eq('back point is its own inverse', JSON.stringify(backPoint(layout(), backPoint(layout(), {x:30, y:40}))), '{"x":30,"y":40}');
    // backPoint has to be the same mirror the layout already uses to put a back
    // behind its front, because that mirror is what the turn the user is told to
    // make physically does. Without this, backPoint could mirror the other axis
    // and every check above would still pass while the test sheet's marks landed
    // in the wrong corners.
    for (const orientation of ['portrait', 'landscape']) for (const flip of ['long', 'short']) {
      S.settings = {...DEFAULTS, pageSize:'letter', orientation, duplexFlip:flip, cardRotation:'upright', bleed:1, margin:5};
      const L4 = layout(), f = slotPos(L4, 0, false), b = slotPos(L4, 0, true);
      const mapped = backPoint(L4, {x:f.x + L4.sw / 2, y:f.y + L4.sh / 2});
      eq(`${orientation} ${flip} back point follows the layout`,
        `${mapped.x.toFixed(3)},${mapped.y.toFixed(3)}`,
        `${(b.x + L4.sw / 2).toFixed(3)},${(b.y + L4.sh / 2).toFixed(3)}`);
    }

    // The wizard adds the reading to what is already there. Replacing it would make
    // the second run of the test undo the first correction instead of confirming it.
    S.settings = {...DEFAULTS, backOffsetX:0.5, backOffsetY:-0.25};
    openDuplexWizard();
    document.querySelector('#duplexWizardX').value = '-0.75';
    document.querySelector('#duplexWizardY').value = '+1';
    document.querySelector('#duplexWizardApply').click();
    eq('wizard adds the X reading', S.settings.backOffsetX, -0.25);
    eq('wizard adds the Y reading', S.settings.backOffsetY, 0.75);
    document.querySelector('#duplexWizardZero').click();
    eq('wizard can clear the correction', `${S.settings.backOffsetX},${S.settings.backOffsetY}`, '0,0');
    closeModal(true);

    // Both calibration sheets have to build. They are only drawn when a button is
    // pressed, so a missing helper or a bad jsPDF call leaves the page loading
    // clean and every other assertion here passing, and is only found by printing.
    // Each orientation is built, because the two sheets lay themselves out
    // differently on a wide page and a tall one.
    const real = window.jspdf.jsPDF, built = {};
    window.jspdf = Object.assign({}, window.jspdf, {jsPDF: function (...a) {
      const d = new real(...a);
      d.save = n => { built[n] = d.internal.getNumberOfPages(); return d; };
      return d;
    }});
    try {
      for (const orientation of ['portrait', 'landscape']) {
        S.settings = {...DEFAULTS, pageSize:'letter', orientation, cardRotation:'upright', bleed:1, margin:5};
        delete built['alignment-sheet.pdf']; delete built['double-sided-test.pdf'];
        for (const id of ['#btnCal', '#btnDuplexTest']) {
          try { document.querySelector(id).click(); } catch (e) { fails.push(`${id} ${orientation}: ${e}`); }
        }
        eq(`alignment sheet builds (${orientation})`, built['alignment-sheet.pdf'], 1);
        eq(`double-sided test builds (${orientation})`, built['double-sided-test.pdf'], 2);
      }
    } finally { window.jspdf = Object.assign({}, window.jspdf, {jsPDF: real}); }
  } finally { S.settings = saved; }
  return fails.length ? {failed: fails} : true;
})()
