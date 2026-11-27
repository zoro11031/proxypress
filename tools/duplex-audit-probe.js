// Regression probe for duplex alignment calculator and scan tool fixes.
(() => {
  const fails = [];
  const saved = S.settings;
  const check = (name, ok, detail = '') => { if (!ok) fails.push(detail ? `${name}: ${detail}` : name); };
  const near = (name, got, want, tol) => check(name, Math.abs(got - want) <= tol, `got ${got} want ${want} ±${tol}`);
  try {
    S.settings = {...DEFAULTS, pageSize: 'letter', orientation: 'landscape', duplexFlip: 'long', backOffsetRel: true};
    const L = layout(), s = S.settings;

    // 1. Two diagonal points on one card (pure shift): must not return all zeros!
    const r2shift = solveDuplexReadings(L, s, [{id: '1A', x: 1.5, y: -0.8}, {id: '1D', x: 1.5, y: -0.8}]);
    check('2 diagonal points solve without error', !r2shift.error, r2shift.error);
    check('2 diagonal points mark collinear', r2shift.collinear === true);
    check('2 diagonal points do not activate both scales', !r2shift.active.includes('backScaleX') && !r2shift.active.includes('backScaleY'), JSON.stringify(r2shift.active));
    near('2 diagonal points backOffsetX', r2shift.values.backOffsetX, -1.5, 0.01);
    near('2 diagonal points backOffsetY', r2shift.values.backOffsetY, 0.8, 0.01);
    near('2 diagonal points rms', r2shift.rms, 0, 0.01);

    // 2. Three collinear diagonal points (1A, 1E, 1D): must solve shift + angle cleanly!
    const r3col = solveDuplexReadings(L, s, [{id: '1A', x: 1.0, y: 0.0}, {id: '1E', x: 1.25, y: -0.25}, {id: '1D', x: 1.5, y: -0.5}]);
    check('3 collinear diagonal points solve without error', !r3col.error, r3col.error);
    check('3 collinear diagonal points drop dual scale', r3col.active.length === 3, JSON.stringify(r3col.active));
    check('3 collinear diagonal points move off zero', Math.hypot(r3col.values.backOffsetX, r3col.values.backOffsetY) > 0.5, JSON.stringify(r3col.values));

    // 3. Two strictly horizontal points (1A, 1B) activate backScaleX; two vertical (1A, 1C) activate backScaleY.
    const r2h = solveDuplexReadings(L, s, [{id: '1A', x: 1.0, y: 0.2}, {id: '1B', x: 1.3, y: 0.2}]);
    check('2 horizontal points activate backScaleX only', r2h.active.includes('backScaleX') && !r2h.active.includes('backScaleY'), JSON.stringify(r2h.active));
    near('2 horizontal points rms', r2h.rms, 0, 0.01);
    const r2v = solveDuplexReadings(L, s, [{id: '1A', x: 0.2, y: 1.0}, {id: '1C', x: 0.2, y: 1.4}]);
    check('2 vertical points activate backScaleY only', r2v.active.includes('backScaleY') && !r2v.active.includes('backScaleX'), JSON.stringify(r2v.active));
    near('2 vertical points rms', r2v.rms, 0, 0.01);

    // 4. Gross outlier resilience (Huber IRLS): 1 bad reading out of 6 does not poison the fit.
    const rOutlier = solveDuplexReadings(L, s, [
      {id: '1A', x: 1.2, y: -0.5}, {id: '1D', x: 1.2, y: -0.5},
      {id: '4A', x: 1.2, y: -0.5}, {id: '4D', x: 1.2, y: -0.5},
      {id: '8A', x: 1.2, y: -0.5}, {id: '8D', x: 5.7, y: -0.5}
    ]);
    check('outlier fit succeeds', !rOutlier.error, rOutlier.error);
    near('outlier fit keeps backOffsetX accurate', rOutlier.values.backOffsetX, -1.2, 0.15);
    near('outlier fit keeps backOffsetY accurate', rOutlier.values.backOffsetY, 0.5, 0.15);
    const flagged = rOutlier.residuals.filter(r => Math.hypot(r.x, r.y) > 0.3).map(r => r.id);
    check('outlier flags only the corrupted reading', flagged.length === 1 && flagged[0] === '8D', JSON.stringify(flagged));

    // 5. Extreme typo rejection.
    const rExtreme = solveDuplexReadings(L, s, [{id: '1A', x: 0, y: 0}, {id: '1B', x: 25, y: 0}]);
    check('extreme typo rejected with error', Boolean(rExtreme.error), JSON.stringify(rExtreme));

    // 6. invertAffine zero-determinant guard.
    check('invertAffine returns null on singular matrix', invertAffine({px: [1, 2, 0], py: [2, 4, 0]}) === null);

    // 7. readDuplexScan with synthetic scan (dimmed background, matte holes G=88, plus 1,500 noise specks).
    const ppm = 8; // ~203 dpi, fast synthetic scan
    const W = Math.ceil(L.W * ppm) + 80, H = Math.ceil(L.H * ppm) + 80;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    g.fillStyle = 'rgb(225,225,222)'; g.fillRect(0, 0, W, H);
    const pts = duplexCardPoints(L, s), f2 = duplexReadSign(L);
    const ox = 40, oy = 40, trueDx = 1.4, trueDy = -0.9;
    // Draw cyan grid lines, black 4-dot squares, orient dot, and slightly matte pin holes (rgb 60,82,65).
    for (const p of pts) {
      g.strokeStyle = 'rgb(0,160,224)'; g.lineWidth = 1;
      const gx = ox + p.mark.x * ppm, gy = oy + p.mark.y * ppm;
      g.beginPath(); g.moveTo(gx - 32, gy); g.lineTo(gx + 32, gy); g.moveTo(gx, gy - 32); g.lineTo(gx, gy + 32); g.stroke();
      g.fillStyle = 'rgb(25,25,25)';
      for (const dm of duplexDotsAt(L, p.pre, s)) {
        g.beginPath(); g.arc(ox + dm.x * ppm, oy + dm.y * ppm, DUPLEX_DOT_R * ppm, 0, Math.PI * 2); g.fill();
      }
      if (p.id === '1A') {
        const od = duplexOrientDot(L, p.pre, s);
        g.beginPath(); g.arc(ox + od.x * ppm, oy + od.y * ppm, DUPLEX_DOT_R * ppm, 0, Math.PI * 2); g.fill();
      }
      // Pin hole at trueDx, trueDy in grid coordinates (using matte dark grey rgb(55,84,60), which would fail old G<80!).
      const hm = duplexMarkAt(L, s, {x: p.pre.x + f2 * trueDx, y: p.pre.y + f2 * trueDy});
      g.fillStyle = 'rgb(55,84,60)';
      g.beginPath(); g.arc(ox + hm.x * ppm, oy + hm.y * ppm, 0.38 * ppm, 0, Math.PI * 2); g.fill();
    }
    // Add 1,500 random dark specks outside the grid interiors to stress-test O(N) spatial quad finder.
    let seed = 42; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    g.fillStyle = 'rgb(20,20,20)';
    for (let k = 0; k < 1500; k++) {
      const sx = 8 + rnd() * (W - 16), sy = 8 + rnd() * (H - 16);
      if (pts.some(p => Math.hypot(ox + p.mark.x * ppm - sx, oy + p.mark.y * ppm - sy) < 12 * ppm)) continue;
      g.beginPath(); g.arc(sx, sy, 2.2, 0, Math.PI * 2); g.fill();
    }
    const imgData = g.getImageData(0, 0, W, H);
    const t0 = performance.now();
    const scanRes = readDuplexScan(imgData, L, s);
    const elapsed = performance.now() - t0;
    check('noisy scan completes fast (< 2500 ms)', elapsed < 2500, `took ${elapsed.toFixed(0)} ms`);
    check('noisy matte scan has no error', !scanRes.error, scanRes.error);
    check('noisy matte scan reads all points', scanRes.readings.length === pts.length, `read ${scanRes.readings.length}/${pts.length}`);
    if (scanRes.readings.length) {
      const maxErr = Math.max(...scanRes.readings.map(r => Math.hypot(r.x - trueDx, r.y - trueDy)));
      near('noisy matte scan max reading error', maxErr, 0, 0.15);
    }
  } catch (err) {
    fails.push('threw: ' + (err.stack || err));
  } finally {
    S.settings = saved;
  }
  return fails.length ? {fails} : true;
})();
