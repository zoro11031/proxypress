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

    // Portrait is the other way round.
    S.settings = {...DEFAULTS, pageSize:'letter', orientation:'portrait', cardRotation:'auto', bleed:0.5, margin:5, dfcMode:'duplex'};
    L = layout();
    eq('portrait mirrorX', L.mirrorX, true);
    eq('portrait turn', duplexTurn(L).axis, 'left to right');
    eq('portrait back rotation', faceRot(L, true), 0);
    eq('portrait manual steps', /left to right/.test(backStepsHtml(1)), true);

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
  } finally { S.settings = saved; }
  return fails.length ? {failed: fails} : true;
})()
