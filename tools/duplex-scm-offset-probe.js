// Probe for tools/console-check.js --probe. Runs inside the page.
//
// Card Maker's own offset (offset_pdf.py, data/offset_data.json) against the
// back settings. The conversion was checked once against upstream's
// offset_images on a rendered page; this keeps it, and its wiring in the
// double-sided wizard, from drifting: whole 1/300 inch steps, X negated on the
// page because Card Maker states it as page 2 reads, Y as it is, the angle as
// it is, and only on Card Maker templates.
(async () => {
  const fails = [];
  const near = (n, got, want, tol = 1e-6) => { if (!(Math.abs(got - want) <= tol)) fails.push(`${n}: got ${got} want ${want}`); };
  const saved = S.settings;
  try {
    const step = 25.4 / 300;
    for (const o of [{x: 12, y: -7, angle: 0.8}, {x: -30, y: 10, angle: -0.25}, {x: 0, y: 0, angle: 0}, {x: 1, y: -1, angle: 1.5}]) {
      const b = backFromScmOffset(o);
      near(`x ${o.x} -> backOffsetX`, b.backOffsetX, -o.x * step, 0.0005);
      near(`y ${o.y} -> backOffsetY`, b.backOffsetY, o.y * step, 0.0005);
      near(`angle ${o.angle} -> backRotate`, b.backRotate, o.angle);
      const back = scmOffsetFromBack({...b});
      if (back.x !== o.x || back.y !== o.y || back.angle !== o.angle) fails.push(`round trip ${JSON.stringify(o)} gave ${JSON.stringify(back)}`);
    }

    // Not offered where Card Maker's page is not ours.
    S.settings = {...DEFAULTS, pageSize: 'letter', orientation: 'landscape'};
    openDuplexWizard();
    if (document.querySelector('#duplexWizardScm')) fails.push('Card Maker offset shown on a plain layout');
    closeModal(true);

    S.settings = cleanSettings({...DEFAULTS, pageSize: 'letter', cardPreset: 'mtg', ...scmSettings({...DEFAULTS, pageSize: 'letter', cardPreset: 'mtg'}, 'standard')});
    openDuplexWizard();
    if (!document.querySelector('#duplexWizardScm')) fails.push('no Card Maker offset on a Card Maker template');
    else {
      const set = (id, v) => { const el = document.querySelector(id); el.value = v; el.dispatchEvent(new Event('input', {bubbles: true})); };
      set('#duplexScmX', '12'); set('#duplexScmY', '-7'); set('#duplexScmA', '0.8');
      document.querySelector('#duplexScmUse').click();
      near('entered X', S.settings.backOffsetX, -12 * step, 0.0005);
      near('entered Y', S.settings.backOffsetY, -7 * step, 0.0005);
      near('entered angle', S.settings.backRotate, 0.8);
      if (!/--x_offset 12 --y_offset -7 --angle 0\.8\b/.test(document.querySelector('#duplexScmNow').textContent)) fails.push(`now line: ${document.querySelector('#duplexScmNow').textContent}`);
      set('#duplexScmX', '1.5'); document.querySelector('#duplexScmUse').click();
      near('a fractional step is refused', S.settings.backOffsetX, -12 * step, 0.0005);

      // A saved offset_data.json, as Card Maker writes it.
      const input = document.querySelector('#duplexScmLoad'), dt = new DataTransfer();
      dt.items.add(new File([JSON.stringify({x_offset: -5, y_offset: 10, angle_offset: 0.5})], 'offset_data.json', {type: 'application/json'}));
      input.files = dt.files; input.dispatchEvent(new Event('change', {bubbles: true}));
      await new Promise(r => setTimeout(r, 100));
      near('loaded X', S.settings.backOffsetX, 5 * step, 0.0005);
      near('loaded Y', S.settings.backOffsetY, 10 * step, 0.0005);
      near('loaded angle', S.settings.backRotate, 0.5);

      // A reading shows the fit in Card Maker's terms too.
      const setRead = (id, x, y) => { for (const [ax, v] of [['x', x], ['y', y]]) { const el = document.querySelector(`#duplexWizardPoints input[data-id="${id}"][data-ax="${ax}"]`); el.value = v; el.dispatchEvent(new Event('input', {bubbles: true})); } };
      setRead('1E', '0.5', '-0.25');
      const sum = document.querySelector('#duplexWizardSum').textContent;
      if (!/offset_pdf\.py --x_offset -?\d+ --y_offset -?\d+ --angle/.test(sum)) fails.push(`summary has no Card Maker line: ${sum}`);
    }
    closeModal(true);
  } catch (e) {
    fails.push('threw: ' + (e && e.stack || e));
  } finally {
    S.settings = saved;
  }
  return fails.length ? {fails} : true;
})();
