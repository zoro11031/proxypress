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
    // Calibrating the front size must not change the back's size. The back scale
    // rides on top of the front one, so at 100% the two sides stay the same size
    // however the front is calibrated - otherwise correcting a 0.3% short front
    // silently shrinks every back by 0.3%, which is 0.8 mm across a Letter sheet.
    S.settings = {...DEFAULTS, pageSize:'letter', orientation:'landscape', duplexFlip:'long',
                  scaleX:100.3, scaleY:100.2, backOffsetRel:true};
    {
      const L = layout(), p = duplexTestPoints(L, duplexTestInset(L));
      near('front scale alone leaves the sides the same width',
           Math.abs(p.marks[1].x - p.marks[0].x) / Math.abs(p.holes[1].x - p.holes[0].x), 1, 1e-9);
      near('front scale alone leaves the sides the same height',
           Math.abs(p.marks[2].y - p.marks[0].y) / Math.abs(p.holes[2].y - p.holes[0].y), 1, 1e-9);
    }
    // The back-page turn. A rotation cannot live in makeT, so it rides on the
    // whole page as a transformation matrix while duplexTestPoints applies the
    // same turn to the key; if those two ever disagree, the sheet would state
    // positions its own marks are not printed at. The contract for the user is
    // that backRotate cancels what the reader reports, sign for sign.
    for (const br of [0, 0.62, -0.35]) {
      S.settings = {...DEFAULTS, pageSize:'letter', orientation:'landscape', duplexFlip:'long',
                    backRotate: br, backOffsetRel:true};
      const L = layout(), p = duplexTestPoints(L, duplexTestInset(L));
      // the turn between the two point sets, measured on the long edge
      const dx = p.marks[1].x - p.marks[0].x, dy = p.marks[1].y - p.marks[0].y;
      const got = -Math.atan2(dy, dx) * 180 / Math.PI;
      // The reader reports the turn as marks-to-holes, which is the opposite
      // sense, so this is the contract: set backRotate to minus what it says.
      near(`backRotate ${br} cancels a reported turn of ${-br}`, got, -br, 1e-9);
      // and the holes, which are the front page, must not move at all
      near(`backRotate ${br} leaves the front alone`, p.holes[0].y - p.holes[1].y, 0, 1e-9);
    }
    // Squaring the print to the paper must not disturb the backs. The flip
    // mirrors the page, so turning both sides the same way in page coordinates
    // would turn them OPPOSITE ways through the paper and move the backs by
    // twice the angle. The back therefore turns the other way, and this holds
    // the two halves of that: the front turns by exactly the setting, and the
    // front-to-back relationship does not move at all.
    for (const pr of [0.21, -0.40]) {
      S.settings = {...DEFAULTS, pageSize:'letter', orientation:'landscape', duplexFlip:'long',
                    printRotate: pr, backRotate: 0, backOffsetRel:true};
      const L = layout(), p = duplexTestPoints(L, duplexTestInset(L));
      const fa = -Math.atan2(p.holes[1].y - p.holes[0].y, p.holes[1].x - p.holes[0].x) * 180 / Math.PI;
      const ba = -Math.atan2(p.marks[1].y - p.marks[0].y, p.marks[1].x - p.marks[0].x) * 180 / Math.PI;
      near(`printRotate ${pr} turns the front by it`, fa, pr, 1e-9);
      near(`printRotate ${pr} leaves the backs where they were`, ba - fa, 0, 1e-9);
    }
    // And the two settings stack without interfering.
    S.settings = {...DEFAULTS, pageSize:'letter', orientation:'landscape', duplexFlip:'long',
                  printRotate: 0.21, backRotate: 0.62, backOffsetRel:true};
    {
      const L = layout(), p = duplexTestPoints(L, duplexTestInset(L));
      const fa = -Math.atan2(p.holes[1].y - p.holes[0].y, p.holes[1].x - p.holes[0].x) * 180 / Math.PI;
      const ba = -Math.atan2(p.marks[1].y - p.marks[0].y, p.marks[1].x - p.marks[0].x) * 180 / Math.PI;
      near('both set: the front squares to the paper', fa, 0.21, 1e-9);
      near('both set: the back still cancels its own turn', ba - fa, -0.62, 1e-9);
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
