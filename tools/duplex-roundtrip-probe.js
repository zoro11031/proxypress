// Probe for tools/console-check.js --probe. Runs inside the page.
//
// Closed loop for the double-sided test. A back page that lands off by a known
// amount must be readable off the printed grid and cancelled by the wizard, in
// every orientation and flip. The trap this guards: on a flip that mirrors top
// to bottom, page 2 prints turned (backPageRot === 180), so its grid's axes run
// the other way and the reading has to be subtracted. Getting that sign wrong
// doubles the error instead of cancelling it, which looks like a worse printer.
(() => {
  const fails = [];
  const eq = (n, got, want) => { if (got !== want) fails.push(`${n}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); };
  const saved = S.settings;
  const r3 = v => +v.toFixed(3);
  try {
    // The page turn each combination needs, which is what the sheet must cancel.
    const want = {'landscape/short': 0, 'landscape/long': 180, 'portrait/long': 0, 'portrait/short': 180};
    for (const orientation of ['landscape', 'portrait']) {
      for (const duplexFlip of ['short', 'long']) {
        const tag = `${orientation}/${duplexFlip}`;
        for (const [ex, ey] of [[1.5, 1.0], [-0.8, 2.2], [0, 0]]) {
          S.settings = {...DEFAULTS, pageSize:'letter', orientation, duplexFlip,
            backOffsetX: ex, backOffsetY: ey};
          const L = layout(), cx = L.W / 2, cy = L.H / 2;
          const rot = backPageRot(L), f2 = rot === 180 ? -1 : 1;
          if (ex === 0) eq(`${tag} page turn`, rot, want[tag]);
          const Tf = makeT(L, false), Tb = makeT(L, true);
          // The hole is where page 1's ring printed; the grid is where page 2's
          // printed. The grid's value at a page point runs with f2, because the
          // sheet draws it through (cx + f2*dx, cy + f2*dy).
          const readX = f2 * (Tf.x(cx) - Tb.x(cx));
          const readY = f2 * (Tf.y(cy) - Tb.y(cy));
          // What the wizard does with that reading.
          const rsgn = rot === 180 ? -1 : 1;
          const nx = r3(S.settings.backOffsetX + rsgn * readX);
          const ny = r3(S.settings.backOffsetY + rsgn * readY);
          if (nx !== 0 || ny !== 0)
            fails.push(`${tag} error (${ex},${ey}) read (${r3(readX)},${r3(readY)}): wizard leaves ${nx},${ny}, want 0,0`);
        }
      }
    }
  } catch (e) { fails.push(`threw: ${e && e.message}`); }
  finally { S.settings = saved; renderAll(); }
  return fails.length ? {fails} : true;
})()
