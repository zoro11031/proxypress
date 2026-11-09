// Probe for tools/console-check.js --probe. Runs inside the page.
// Returns true, or an object naming what did not match (which fails the run).
//
// Covers the two things that made double-sided output land wrong: which way the
// sheet has to be turned for a given layout, and whether the printer offset
// reaches the back pages.
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
  } finally { S.settings = saved; }
  return fails.length ? {failed: fails} : true;
})()
