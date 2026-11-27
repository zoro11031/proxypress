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

    // 8. duplexCardTestDoc stamps the baked-in back baseline on both pages.
    {
      const d0 = duplexCardTestDoc(L, s).doc;
      const p0a = d0.internal.pages[1].join('\n'), p0b = d0.internal.pages[2].join('\n');
      check('zero-baseline test PDF stamps 0 on page 1', p0a.includes('Back baseline baked into this test: 0'));
      check('zero-baseline test PDF stamps 0 on page 2', p0b.includes('Back baseline baked into this test: 0'));
      const sNonZero = {...s, backOffsetX: 2.8, backOffsetY: -2.2, backRotate: -0.62, backScaleX: 100.1, backScaleY: 100};
      const d1 = duplexCardTestDoc(L, sNonZero).doc;
      const p1a = d1.internal.pages[1].join('\n'), p1b = d1.internal.pages[2].join('\n');
      check('non-zero test PDF stamps active offset on page 1', p1a.includes('Back baseline baked into this test: X +2.80 mm, Y -2.20 mm, angle -0.62'));
      check('non-zero test PDF stamps active offset on page 2', p1b.includes('Back baseline baked into this test: X +2.80 mm, Y -2.20 mm, angle -0.62'));
    }

    // 9. Duplex wizard warns when existing back alignment is active and supports "Replace from 0".
    {
      S.settings = {...s, backOffsetX: 0, backOffsetY: 0, backRotate: 0, backScaleX: 100, backScaleY: 100};
      openDuplexWizard();
      check('wizard hides baseline warning at 0', $('#duplexWizardBaseWarn').hidden === true && $('#duplexWizardTestNote').hidden === true);
      closeModal(true);

      S.settings = {...s, backOffsetX: 2.8, backOffsetY: -2.2, backRotate: -0.62, backScaleX: 100.12, backScaleY: 100.04};
      openDuplexWizard();
      check('wizard shows baseline warning when non-zero', $('#duplexWizardBaseWarn').hidden === false && $('#duplexWizardTestNote').hidden === false);
      check('wizard warning lists active offset values', $('#duplexWizardBaseVals').textContent.includes('+2.80 mm') && $('#duplexWizardBaseVals').textContent.includes('-2.20 mm'));
      const setRead = (id, x, y) => { for (const [ax, v] of [['x', x], ['y', y]]) { const el = document.querySelector(`#duplexWizardPoints input[data-id="${id}"][data-ax="${ax}"]`); el.value = v; el.dispatchEvent(new Event('input', {bubbles: true})); } };
      setRead('1E', '0.5', '1.0');
      const sumStack = $('#duplexWizardSum').textContent;
      check('default mode stacks onto current values', sumStack.includes('Adding onto current back alignment'));
      // Switch to Replace from 0 without losing readings.
      const zeroRadio = document.querySelector('#duplexWizardBaseOpts input[value="zero"]');
      zeroRadio.checked = true;
      zeroRadio.dispatchEvent(new Event('change', {bubbles: true}));
      const sumZero = $('#duplexWizardSum').textContent;
      check('replace-from-0 mode updates summary live', sumZero.includes('Replacing current back alignment from a 0 baseline') && sumZero.includes('-0.50 mm'));
      $('#duplexWizardApply').click();
      near('replace-from-0 applies X from 0', S.settings.backOffsetX, -0.5, 0.01);
      near('replace-from-0 applies Y from 0', S.settings.backOffsetY, -1.0, 0.01);
      near('replace-from-0 clears stale backRotate', S.settings.backRotate, 0, 1e-6);
      near('replace-from-0 clears stale backScaleX', S.settings.backScaleX, 100, 1e-6);
      near('replace-from-0 clears stale backScaleY', S.settings.backScaleY, 100, 1e-6);
      closeModal(true);
    }

    // 10. Two-pass dummy-pin algorithm: Pass 1 (5-param) -> Pass 2 rigid residual (locks Pass 1 scale)
    //     + Pass 2 genuine scale shift (unlocks scale) + verified state + toner-loaded scan roundtrip.
    {
      const Lscm = layout({...DEFAULTS, silhouette: true, pageSize: 'letter', cardPreset: 'mtg', orientation: 'landscape', scmTemplate: 'standard', backOffsetRel: true});
      const s0 = {...DEFAULTS, silhouette: true, pageSize: 'letter', cardPreset: 'mtg', orientation: 'landscape', scmTemplate: 'standard', backOffsetRel: true,
        backOffsetX: 0, backOffsetY: 0, backRotate: 0, backScaleX: 100, backScaleY: 100};
      const s1True = {...s0, backOffsetX: -0.488, backOffsetY: -1.084, backRotate: -0.263, backScaleX: 100.12, backScaleY: 100.039};
      const s2True = {...s0, backOffsetX: -1.56, backOffsetY: -1.26, backRotate: -0.57, backScaleX: 100.12, backScaleY: 100.039};
      const f2s = duplexReadSign(Lscm);

      // Helper: synthesize exact grid readings produced when PDF is printed with `sPrinted`
      // and the physical sheet lands where `sTarget` would put each mark.
      const synthReadings = (sPrinted, sTarget, noiseAmp = 0) => {
        const ptsP = duplexCardPoints(Lscm, sPrinted);
        const TbP = makeT(Lscm, true, sPrinted);
        const aP = -turnAngle(true, sPrinted) * Math.PI / 180;
        const cx = Lscm.W / 2, cy = Lscm.H / 2;
        const kx = sPrinted.backScaleX / 100, ky = sPrinted.backScaleY / 100;
        let rng = 1337;
        const nrm = () => { rng = (rng * 16807) % 2147483647; return ((rng / 2147483647) * 2 - 1) * noiseAmp; };
        return ptsP.map(p => {
          const mT = duplexMarkAt(Lscm, sTarget, p.pre);
          // Invert turnPt(Lscm, TbP(pre_hole)) = mT
          const dx = mT.x - cx, dy = mT.y - cy;
          const ux = cx + dx * Math.cos(aP) - dy * Math.sin(aP);
          const uy = cy + dx * Math.sin(aP) + dy * Math.cos(aP);
          const preHx = cx + (ux - cx - sPrinted.backOffsetX) / kx;
          const preHy = cy + (uy - cy - sPrinted.backOffsetY) / ky;
          return {id: p.id, x: +(f2s * (preHx - p.pre.x) + nrm()).toFixed(3), y: +(f2s * (preHy - p.pre.y) + nrm()).toFixed(3)};
        });
      };

      // Pass 1 from 0: recovers all 5 params.
      const r1 = synthReadings(s0, s1True, 0);
      const fit1 = solveDuplexReadings(Lscm, s0, r1, {pass2: false});
      check('Pass 1 fits cleanly', !fit1.error && fit1.active.length === 5, JSON.stringify(fit1));
      near('Pass 1 backOffsetX', fit1.values.backOffsetX, -0.488, 0.01);
      near('Pass 1 backOffsetY', fit1.values.backOffsetY, -1.084, 0.01);
      near('Pass 1 backRotate', fit1.values.backRotate, -0.263, 0.005);
      near('Pass 1 backScaleX', fit1.values.backScaleX, 100.12, 0.01);
      near('Pass 1 backScaleY', fit1.values.backScaleY, 100.039, 0.01);

      // Pass 2 rigid toner/feed drift with realistic ±0.10 mm pinhole noise: locks Pass 1 scale & solves exact shift+angle.
      const s1 = {...s0, ...fit1.values};
      const r2 = synthReadings(s1, s2True, 0.10);
      const fit2 = solveDuplexReadings(Lscm, s1, r2, {pass2: true});
      check('Pass 2 rigid fit succeeds', !fit2.error, fit2.error);
      check('Pass 2 locks Pass 1 scale on clean rigid residual', fit2.scaleLocked === true && !fit2.active.includes('backScaleX') && !fit2.active.includes('backScaleY'), JSON.stringify(fit2));
      check('Pass 2 reports pre-correction rawRms > 1.0 mm', fit2.rawRms > 1.0 && fit2.rms < 0.15, `rawRms=${fit2.rawRms} rms=${fit2.rms}`);
      near('Pass 2 compounded backOffsetX', fit2.values.backOffsetX, -1.56, 0.05);
      near('Pass 2 compounded backOffsetY', fit2.values.backOffsetY, -1.26, 0.05);
      near('Pass 2 compounded backRotate', fit2.values.backRotate, -0.57, 0.02);

      // Pass 2 with genuine thermal scale shrinkage (-0.30%): unlocks scale automatically.
      const s2Shrunk = {...s2True, backScaleX: 99.82, backScaleY: 99.74};
      const r2Shrink = synthReadings(s1, s2Shrunk, 0.03);
      const fit2Shrink = solveDuplexReadings(Lscm, s1, r2Shrink, {pass2: true});
      check('Pass 2 unlocks scale on genuine thermal shrinkage', !fit2Shrink.error && fit2Shrink.scaleLocked === false && fit2Shrink.active.includes('backScaleX') && fit2Shrink.active.includes('backScaleY'), JSON.stringify(fit2Shrink));
      near('Pass 2 thermal shrinkage backScaleX', fit2Shrink.values.backScaleX, 99.82, 0.03);
      near('Pass 2 thermal shrinkage backScaleY', fit2Shrink.values.backScaleY, 99.74, 0.03);

      // Pass 2 already aligned: verified === true.
      const s2Applied = {...s1, ...fit2.values};
      const r3 = synthReadings(s2Applied, s2Applied, 0.08);
      const fit3 = solveDuplexReadings(Lscm, s2Applied, r3, {pass2: true});
      check('Pass 2 within tolerance sets verified=true', !fit3.error && fit3.verified === true, JSON.stringify({rawRms: fit3.rawRms, rawMax: fit3.rawMax, verified: fit3.verified}));

      // Toner-loaded Pass 2 PDF stamps toner-matched and survives readDuplexScan 40/40.
      const dToner = duplexCardTestDoc(Lscm, s1, {tonerLoad: true}).doc;
      check('toner-matched PDF stamps toner-matched on page 1', dToner.internal.pages[1].join('\n').includes('toner-matched'));
      check('toner-matched PDF stamps toner-matched on page 2', dToner.internal.pages[2].join('\n').includes('toner-matched'));

      const ppmT = 8, Wt = Math.ceil(Lscm.W * ppmT) + 40, Ht = Math.ceil(Lscm.H * ppmT) + 40;
      const cvt = document.createElement('canvas'); cvt.width = Wt; cvt.height = Ht;
      const gt = cvt.getContext('2d');
      gt.fillStyle = 'rgb(245,245,245)'; gt.fillRect(0, 0, Wt, Ht);
      const oxt = 20, oyt = 20, Tb1 = makeT(Lscm, true, s1), pts1 = duplexCardPoints(Lscm, s1), oDy1 = duplexOrientDy(Lscm);
      // Draw dark toner card fills, then pure white grid knockouts, then cyan grids, black dots, and pin holes.
      for (let i = 0; i < Lscm.per; i++) {
        const pb = slotPos(Lscm, i, true, s1);
        const tl = turnPt(Lscm, {x: Tb1.x(pb.x), y: Tb1.y(pb.y)}, true, s1);
        gt.fillStyle = 'rgb(30,30,30)';
        gt.fillRect(oxt + tl.x * ppmT, oyt + tl.y * ppmT, Tb1.w(Lscm.sw) * ppmT, Tb1.h(Lscm.sh) * ppmT);
      }
      for (const p of pts1) {
        let yLo = 7.0, yHi = 7.0;
        if (f2s > 0) yHi = Math.max(yHi, 9.2); else yLo = Math.max(yLo, 9.2);
        if (p.card === 0 && p.letter === 'A') { if (oDy1 > 0) yHi = Math.max(yHi, oDy1 + 2.2); else yLo = Math.max(yLo, -oDy1 + 2.2); }
        const wtl = duplexMarkAt(Lscm, s1, {x: p.pre.x - 7.0, y: p.pre.y - yLo});
        gt.fillStyle = 'rgb(245,245,245)';
        gt.fillRect(oxt + wtl.x * ppmT, oyt + wtl.y * ppmT, Tb1.w(14.0) * ppmT, Tb1.h(yLo + yHi) * ppmT);
        gt.strokeStyle = 'rgb(0,160,224)'; gt.lineWidth = 1;
        const gx = oxt + p.mark.x * ppmT, gy = oyt + p.mark.y * ppmT;
        gt.beginPath(); gt.moveTo(gx - 24, gy); gt.lineTo(gx + 24, gy); gt.moveTo(gx, gy - 24); gt.lineTo(gx, gy + 24); gt.stroke();
        gt.fillStyle = 'rgb(18,18,18)';
        for (const dm of duplexDotsAt(Lscm, p.pre, s1)) {
          gt.beginPath(); gt.arc(oxt + dm.x * ppmT, oyt + dm.y * ppmT, DUPLEX_DOT_R * ppmT, 0, Math.PI * 2); gt.fill();
        }
        if (p.id === '1A') {
          const od = duplexOrientDot(Lscm, p.pre, s1);
          gt.beginPath(); gt.arc(oxt + od.x * ppmT, oyt + od.y * ppmT, DUPLEX_DOT_R * ppmT, 0, Math.PI * 2); gt.fill();
        }
        const hm = duplexMarkAt(Lscm, s2True, p.pre);
        gt.fillStyle = 'rgb(45,65,50)';
        gt.beginPath(); gt.arc(oxt + hm.x * ppmT, oyt + hm.y * ppmT, 0.38 * ppmT, 0, Math.PI * 2); gt.fill();
      }
      const scanT = readDuplexScan(gt.getImageData(0, 0, Wt, Ht), Lscm, s1);
      check('toner-matched Pass 2 scan succeeds without error', !scanT.error, scanT.error);
      check('toner-matched Pass 2 scan reads all 40 points', scanT.readings.length === pts1.length, `read ${scanT.readings.length}/${pts1.length}`);
      const fitScanT = solveDuplexReadings(Lscm, s1, scanT.readings, {pass2: true});
      near('toner-matched Pass 2 scan recovers backOffsetX', fitScanT.values.backOffsetX, -1.56, 0.08);
      near('toner-matched Pass 2 scan recovers backOffsetY', fitScanT.values.backOffsetY, -1.26, 0.08);
      near('toner-matched Pass 2 scan recovers backRotate', fitScanT.values.backRotate, -0.57, 0.04);

      // Wizard UI Pass 1 -> Pass 2 transition on laser printer auto-enables toner-matched Pass 2.
      const prevPrinter = S.printer;
      S.printer = 'mf753';
      S.settings = {...s0};
      openDuplexWizard();
      check('Pass 1 starts on Pass 1 pill with toner unchecked', $('#duplexPass1Pill').classList.contains('on') && !$('#duplexWizardToner').checked);
      const setRead2 = (id, x, y) => { for (const [ax, v] of [['x', x], ['y', y]]) { const el = document.querySelector(`#duplexWizardPoints input[data-id="${id}"][data-ax="${ax}"]`); el.value = v; el.dispatchEvent(new Event('input', {bubbles: true})); } };
      setRead2('1E', '0.5', '1.0');
      $('#duplexWizardApply').click();
      check('Applying Pass 1 advances wizard to Pass 2 pill and auto-checks toner match on laser',
        $('#duplexPass2Pill').classList.contains('on') && $('#duplexPass1Pill').classList.contains('done') && $('#duplexWizardToner').checked === true);
      check('Pass 1 status prompts printing Pass 2', $('#duplexWizardStatus').textContent.includes('Pass 2'));
      closeModal(true);
      S.printer = prevPrinter;
    }
  } catch (err) {
    fails.push('threw: ' + (err.stack || err));
  } finally {
    S.settings = saved;
  }
  return fails.length ? {fails} : true;
})();
