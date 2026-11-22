// Probe for tools/console-check.js --probe. Runs inside the page.
//
// The double-sided card test and its fit, against a known answer. A simulated
// printer puts the back page down through a transform G - a shift, a turn and
// a size change, which is what a second pass does - and the readings are what
// that sheet would show: hole minus where the grid's zero actually printed,
// in the grid's own reading. Applying the fit must put every back point onto
// its hole through the same G, with the front untouched. Too few points must
// fit only what they can see, and a sheared back must be reported.
(() => {
  const fails = [];
  const saved = S.settings;
  const near = (n, got, want, tol) => { if (!(Math.abs(got - want) <= tol)) fails.push(`${n}: got ${got} want ${want} +-${tol}`); };
  const G = (L, p, g) => {
    const cx = L.W / 2, cy = L.H / 2, a = g.rot * Math.PI / 180, u = (p.x - cx) * g.sx, v = (p.y - cy) * g.sy;
    return {x: cx + u * Math.cos(a) - v * Math.sin(a) + g.dx + g.shear * v, y: cy + u * Math.sin(a) + v * Math.cos(a) + g.dy};
  };
  const readingsFor = (L, s, g, ids) => {
    const f = duplexReadSign(L);
    return duplexCardPoints(L, s).filter(p => !ids || ids.includes(p.id)).map(p => {
      const m = G(L, p.mark, g);
      return {id: p.id, x: f * (p.hole.x - m.x), y: f * (p.hole.y - m.y)};
    });
  };
  try {
    const g = {dx: 0.9, dy: -0.6, rot: 0.35, sx: 1.002, sy: 0.9985, shear: 0};
    const cases = [];
    for (const orientation of ['landscape', 'portrait']) for (const duplexFlip of ['long', 'short'])
      cases.push({...DEFAULTS, pageSize: 'letter', orientation, duplexFlip, backOffsetRel: true});
    cases.push(cleanSettings({...DEFAULTS, pageSize: 'letter', cardPreset: 'mtg', ...scmSettings({...DEFAULTS, pageSize: 'letter', cardPreset: 'mtg'}, 'standard')}));
    cases.push(cleanSettings({...DEFAULTS, pageSize: 'a4', cardPreset: 'mtg', ...scmSettings({...DEFAULTS, pageSize: 'a4', cardPreset: 'mtg'}, 'borderless')}));
    for (const base of cases) {
      S.settings = {...base};
      const L = layout(), tag = `${base.pageSize}/${base.orientation}/${base.duplexFlip}${L.scm ? '/scm ' + base.scmTemplate : ''}`;
      const holesBefore = JSON.stringify(duplexCardPoints(L, S.settings).map(p => p.hole));
      const fit = solveDuplexReadings(L, S.settings, readingsFor(L, S.settings, g));
      if (fit.error) { fails.push(`${tag}: ${fit.error}`); continue; }
      if (fit.active.length !== 5) fails.push(`${tag}: a full sheet should fit all five values, got ${fit.active}`);
      near(`${tag} fit is exact on a square transform`, fit.max, 0, 0.005);
      const after = {...S.settings, ...fit.values};
      // Through the same printer, every back point now lands on its hole. One sheet
      // only shows hole minus mark, never where the printer put the mark, so the
      // correction is first order: a 0.35 degree, 0.2% back leaves under 0.02 mm,
      // half a 600 dpi dot, and the next sheet takes that out too.
      let worst = 0;
      for (const p of duplexCardPoints(L, after)) { const m = G(L, p.mark, g); worst = Math.max(worst, Math.hypot(p.hole.x - m.x, p.hole.y - m.y)); }
      near(`${tag} next sheet reads zero`, worst, 0, 0.025);
      if (JSON.stringify(duplexCardPoints(L, after).map(p => p.hole)) !== holesBefore) fails.push(`${tag}: fitting the back moved the front`);
      if (fit.shear !== null && Math.abs(fit.shear) > 0.01) fails.push(`${tag}: no shear in the input, reported ${fit.shear}`);
      // One point: offset only, and it zeroes that point.
      const one = solveDuplexReadings(L, S.settings, readingsFor(L, S.settings, g, ['1E']));
      if (one.active.join() !== 'backOffsetX,backOffsetY') fails.push(`${tag}: one point should fit the offset only, got ${one.active}`);
      // One card's five points span 50 mm or so: offset and turn, and size only where wide enough.
      const card = solveDuplexReadings(L, S.settings, readingsFor(L, S.settings, g, ['1A', '1B', '1C', '1D', '1E']));
      if (!card.active.includes('backRotate')) fails.push(`${tag}: one card's corners should fit the turn, got ${card.active}`);
    }
    // A sheared back cannot be fitted by any setting: it must be measured and said.
    S.settings = {...DEFAULTS, pageSize: 'letter', orientation: 'landscape', duplexFlip: 'long', backOffsetRel: true};
    const L = layout(), sheared = solveDuplexReadings(L, S.settings, readingsFor(L, S.settings, {...g, shear: 0.004}));
    near('shear of 0.004 is reported in degrees', Math.abs(sheared.shear), Math.atan(0.004) * 180 / Math.PI, 0.01);
    if (!(sheared.max > 0.05)) fails.push(`a sheared back should leave a residual, got ${sheared.max}`);
    // The sheet itself: two pages, and the right number of pierce points.
    const {doc, points} = duplexCardTestDoc(L, S.settings);
    if (doc.getNumberOfPages() !== 2) fails.push(`test has ${doc.getNumberOfPages()} pages`);
    if (points.length !== L.per * 5) fails.push(`expected ${L.per * 5} points, got ${points.length}`);
  } catch (e) {
    fails.push('threw: ' + (e && e.stack || e));
  } finally {
    S.settings = saved;
  }
  return fails.length ? {fails} : true;
})();
