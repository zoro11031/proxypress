// Probe for tools/console-check.js --probe. Runs inside the page.
//
// The double-sided fit against 1,600 random printers: 40 layouts (letter, A4 and
// legal, both orientations, both flips, three bleeds, and Card Maker templates),
// each with 40 back errors up to 4 mm, 2 degrees and 0.5% evenly in size, half of
// them printed through a back that was calibrated before, some with a front offset
// and turn. The readings are exact grid numbers, so the next sheet must land on
// every hole to 3 microns - what storing the settings to three decimals leaves -
// with the front untouched and no shear reported where there is none. Uneven
// size combined with a turn is a real shear no setting can take out; see
// duplex-card-probe for that case.
(() => {
  const saved = S.settings, out = {runs: 0, worstNext: 0, worstTag: '', fails: [], subsetWorst: 0};
  let seed = 7; const rnd = (a, b) => { seed = (seed * 16807) % 2147483647; return a + (b - a) * seed / 2147483647; };
  const G = (L, p, g) => { const cx = L.W/2, cy = L.H/2, a = g.rot*Math.PI/180, u = (p.x-cx)*g.sx, v = (p.y-cy)*g.sy;
    return {x: cx + u*Math.cos(a) - v*Math.sin(a) + g.dx, y: cy + u*Math.sin(a) + v*Math.cos(a) + g.dy}; };
  const read = (L, s, g, pts) => { const f = duplexReadSign(L); return pts.map(p => {
    const at = (dx, dy) => G(L, duplexMarkAt(L, s, {x: p.pre.x+dx, y: p.pre.y+dy}), g);
    const m = at(0,0), ex = at(1,0), ey = at(0,1), a = ex.x-m.x, b = ey.x-m.x, c = ex.y-m.y, d = ey.y-m.y, u = p.hole.x-m.x, v = p.hole.y-m.y, det = a*d-b*c;
    return {id: p.id, x: f*(d*u-b*v)/det, y: f*(-c*u+a*v)/det}; }); };
  const bases = [];
  for (const pageSize of ['letter','a4','legal']) for (const orientation of ['landscape','portrait']) for (const duplexFlip of ['long','short']) for (const bleed of [0, 1, 2])
    bases.push({...DEFAULTS, pageSize, orientation, duplexFlip, bleed});
  for (const pageSize of ['letter','a4']) for (const t of ['standard','borderless'])
    bases.push(cleanSettings({...DEFAULTS, pageSize, cardPreset:'mtg', ...scmSettings({...DEFAULTS, pageSize, cardPreset:'mtg'}, t)}));
  try {
    for (const base of bases) for (let k = 0; k < 40; k++) {
      // Printer errors from nothing to well past what the grid can show by eye.
      const g = {dx: rnd(-4, 4), dy: rnd(-4, 4), rot: rnd(-2, 2), sx: rnd(0.995, 1.005), sy: 0}; g.sy = g.sx;
      const cal = k % 2 ? {backRotate: rnd(-1, 1), backScaleX: rnd(99.6, 100.4), backScaleY: rnd(99.6, 100.4), backOffsetX: rnd(-2, 2), backOffsetY: rnd(-2, 2)} : {};
      const s = {...base, ...cal, printRotate: k % 5 === 0 ? rnd(-0.5, 0.5) : 0, offsetX: k % 3 ? rnd(-1, 1) : 0, offsetY: k % 3 ? rnd(-1, 1) : 0};
      S.settings = s; const L = layout(), pts = duplexCardPoints(L, s), tag = `${s.pageSize}/${s.orientation}/${s.duplexFlip}/b${s.bleed}${L.scm ? '/'+s.scmTemplate : ''}#${k}`;
      const holes = JSON.stringify(pts.map(p => p.hole));
      const fit = solveDuplexReadings(L, s, read(L, s, g, pts)); out.runs++;
      if (fit.error) { out.fails.push(tag + ': ' + fit.error); continue; }
      const after = {...s, ...fit.values};
      let worst = 0; for (const p of duplexCardPoints(L, after)) { const m = G(L, p.mark, g); worst = Math.max(worst, Math.hypot(p.hole.x-m.x, p.hole.y-m.y)); }
      if (worst > out.worstNext) { out.worstNext = worst; out.worstTag = tag + ' ' + JSON.stringify(g); }
      // The floor: the correction needed is S^-1 R^-1, the settings give R K. With
      // isotropic S the two agree; otherwise what is left is the shear between them.
      const ar = g.rot*Math.PI/180, rmax = Math.max(...pts.map(p => Math.hypot(p.hole.x - L.W/2, p.hole.y - L.H/2)));
      const floor = Math.abs(1/g.sx - 1/g.sy) * Math.abs(Math.sin(ar)) * rmax;
      out.maxOverFloor = Math.max(out.maxOverFloor || 0, worst - floor);
      if (worst > floor + 0.003) out.fails.push(`${tag}: next sheet ${worst.toFixed(4)} mm, floor ${floor.toFixed(4)}`);
      // The shear that S^-1 R^-1 has, in degrees: 90 minus the angle between its columns.
      const M = [[Math.cos(ar)/g.sx, Math.sin(ar)/g.sx], [-Math.sin(ar)/g.sy, Math.cos(ar)/g.sy]];
      const expShear = 90 - Math.acos((M[0][0]*M[0][1] + M[1][0]*M[1][1]) / (Math.hypot(M[0][0], M[1][0]) * Math.hypot(M[0][1], M[1][1]))) * 180/Math.PI;
      if (fit.shear !== null) out.shearErr = Math.max(out.shearErr || 0, Math.abs(Math.abs(fit.shear) - Math.abs(expShear)));
      if (JSON.stringify(duplexCardPoints(L, after).map(p => p.hole)) !== holes) out.fails.push(tag + ': front moved');
      // Three cards' centres only: offset, turn and scale where spread allows; check the points used.
      const sub = pts.filter(p => p.letter === 'E').slice(0, 3), f2 = solveDuplexReadings(L, s, read(L, s, g, sub));
      for (const r of f2.residuals) out.subsetWorst = Math.max(out.subsetWorst, Math.hypot(r.x, r.y));
    }
  } catch (e) { out.fails.push('threw ' + (e.stack || e)); }
  S.settings = saved; if ((out.shearErr || 0) > 1e-6) out.fails.push(`shear off by ${out.shearErr}`);
  return out.fails.length ? {fails: out.fails.slice(0, 20), worstNext: out.worstNext} : true;
})();
