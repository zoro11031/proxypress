// Probe for tools/console-check.js --probe. Runs inside the page.
//
// The scan path's closed loop. Page 2 of the double-sided test states, in its
// own key, where the four back marks were printed and where a pin through the
// front's four marks comes out on that side. The difference is the correction
// a reader of the scan hands back. Applying it must leave a sheet whose
// difference is zero, in every flip and orientation and at any printer offset.
//
// The printer offset is the trap: it costs twice itself on whichever axis the
// turn mirrors, and nothing at all on the other. A loop that only ever added
// would double that error instead of cancelling it.
(() => {
  const fails = [];
  const saved = S.settings;
  const near = (n, got, want, tol = 1e-6) => {
    if (!(Math.abs(got - want) <= tol)) fails.push(`${n}: got ${got.toFixed(4)} want ${want.toFixed(4)}`);
  };
  try {
    for (const orientation of ['landscape', 'portrait'])
      for (const duplexFlip of ['long', 'short'])
        for (const [offsetX, offsetY] of [[0, 0], [1, 0], [0, 1.25], [-0.6, 0.4]]) {
          const base = {...DEFAULTS, pageSize:'letter', orientation, duplexFlip,
                        offsetX, offsetY, backOffsetX:0, backOffsetY:0, backOffsetRel:true};
          S.settings = base;
          let L = layout(), pts = duplexTestPoints(L, duplexTestInset(L));
          const tag = `${orientation}/${duplexFlip} off ${offsetX},${offsetY}`;
          const dx = pts.holes[0].x - pts.marks[0].x, dy = pts.holes[0].y - pts.marks[0].y;
          // Four corners must say the same thing: a pure shift, no turn, no
          // size change. Anything else here is the sheet's geometry, not the
          // printer's, and would be read as skew off a real scan.
          for (let i = 1; i < 4; i++) {
            near(`${tag} corner ${i + 1} agrees on X`, pts.holes[i].x - pts.marks[i].x, dx);
            near(`${tag} corner ${i + 1} agrees on Y`, pts.holes[i].y - pts.marks[i].y, dy);
          }
          near(`${tag} X cost of the printer offset`, dx, L.mirrorX ? -2 * offsetX : 0, 1e-9);
          near(`${tag} Y cost of the printer offset`, dy, L.mirrorX ? 0 : -2 * offsetY, 1e-9);
          // Apply what the sheet says, and the next sheet reads zero.
          S.settings = {...base, backOffsetX: +dx.toFixed(6), backOffsetY: +dy.toFixed(6)};
          L = layout(); pts = duplexTestPoints(L, duplexTestInset(L));
          near(`${tag} settles X`, pts.holes[0].x - pts.marks[0].x, 0, 1e-5);
          near(`${tag} settles Y`, pts.holes[0].y - pts.marks[0].y, 0, 1e-5);
        }
    // A back-page scale error has to show as a size difference between the two
    // point sets, or the reader has nothing to report it from.
    S.settings = {...DEFAULTS, pageSize:'letter', orientation:'landscape', duplexFlip:'long',
                  backScaleX:100.5, backOffsetRel:true};
    const L = layout(), pts = duplexTestPoints(L, duplexTestInset(L));
    const mw = Math.abs(pts.marks[1].x - pts.marks[0].x);
    const hw = Math.abs(pts.holes[1].x - pts.holes[0].x);
    near('a 0.5% back scale shows as 0.5% between the marks', mw / hw, 1.005, 1e-6);
  } catch (e) { fails.push(`threw: ${e && e.message}`); }
  finally { S.settings = saved; renderAll(); }
  return fails.length ? {fails} : true;
})()
