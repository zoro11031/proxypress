// Probe for tools/console-check.js --probe. Runs inside the page.
// Returns true, or an object naming what did not match (which fails the run).
//
// The .studio3 export rewrites a real Silhouette Card Maker template in place.
// That is only safe while the file's length never changes and nothing but the
// card coordinates moves, because the container carries byte offsets and
// counters that have not been decoded. So this checks exactly that, and then
// checks the geometry it wrote is the geometry the SVG and DXF agree on.
(async () => {
  const fails = [];
  const eq = (name, got, want) => { if (got !== want) fails.push(`${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); };
  const near = (name, got, want, tol = 0.01) => { if (!(Math.abs(got - want) <= tol)) fails.push(`${name}: got ${got} want ${want} +-${tol}`); };
  const saved = JSON.parse(JSON.stringify(S.settings));

  try {
    const manRes = await fetch('assets/studio3/manifest.json');
    if (!manRes.ok) return {failed: [`manifest not served: HTTP ${manRes.status}`]};
    const man = await manRes.json();

    for (const paper of ['letter', 'a4']) for (const orientation of ['landscape', 'portrait']) {
      S.settings = {...DEFAULTS, pageSize: paper, orientation, silhouette: true, guides: 'none',
        ...cameoPaperLayout(orientation)};
      const L = layout(), tag = `${paper}/${orientation}`;
      const pad = orientation === 'portrait' ? 6.5 : 0;
      const key = studio3Key();
      if (!key) { fails.push(`${tag}: no Studio base`); continue; }
      const spec = man[key];
      if (!spec) { fails.push(`${tag}: manifest has no ${key}`); continue; }

      // The base has to hold exactly as many cards as the sheet does, or the
      // in-place rewrite is not available at all.
      eq(`${tag} base card count`, spec.cards, L.per);

      const baseBuf = new Uint8Array(await (await fetch(`assets/studio3/${spec.file}`)).arrayBuffer());
      // The archived Catan base is still tested with its explicit arm length.
      if (key === 'letter-portrait') S.settings.regLen = STUDIO3_ARMS[key];
      const out = await cutStudio3(0);
      eq(`${tag} length unchanged`, out.length, baseBuf.length);
      eq(`${tag} length matches manifest`, out.length, spec.bytes);

      // Nothing outside the recorded point slots and the page size may move.
      const allowed = new Set();
      for (const off of spec.pageOffsets) for (let k = 0; k < 4; k++) allowed.add(off + k);
      for (const card of spec.outlines) for (const o of card)
        for (const off of o.o) for (let k = 0; k < 8; k++) allowed.add(off + k);
      const strayed = [];
      for (let i = 0; i < out.length && strayed.length < 4; i++)
        if (out[i] !== baseBuf[i] && !allowed.has(i)) strayed.push(i);
      eq(`${tag} only coordinates changed`, strayed.map(i => '0x' + i.toString(16)).join(','), '');

      const dv = new DataView(out.buffer);
      near(`${tag} page width`, dv.getFloat32(spec.pageOffsets[0], true), L.W+2*pad);
      near(`${tag} page height`, dv.getFloat32(spec.pageOffsets[1], true), L.H+2*pad);
      near(`${tag} stored arm equals the printed arm`, dv.getFloat32(1137, true), regArm(L), 0.001);

      // Read every outline back and check it against the SVG the same sheet
      // would export: one geometry, three files, no second opinion.
      const rects = Array.from(new DOMParser().parseFromString(cutSvg(0), 'image/svg+xml').querySelectorAll('rect'));
      let wrote = 0;
      spec.outlines.forEach((card, i) => {
        card.forEach((o, c) => {
          const pts = o.o.map(off => [dv.getFloat32(off, true), dv.getFloat32(off + 4, true)]);
          const ys = pts.map(p => o.f ? -p[1] : p[1]);
          const xs = pts.map(p => p[0]);
          const x = Math.min(...xs), y = Math.min(...ys);
          const w = Math.max(...xs) - x, h = Math.max(...ys) - y;
          // Slots past the end of a short sheet still carry a card outline,
          // because the count is fixed; compare against the SVG where it has one.
          const r = rects[i];
          if (r) {
            near(`${tag} card ${i} copy ${c} width`, w, +r.getAttribute('width'));
            near(`${tag} card ${i} copy ${c} height`, h, +r.getAttribute('height'));
            // Tolerance below the per-copy offsets themselves (dx is about
            // 0.004 mm, dy about 0.027). At a looser tolerance these pass
            // whether or not the offsets are preserved, which is how a first
            // version of this probe reported a clean run while the writer
            // was dropping them.
            near(`${tag} card ${i} copy ${c} x`, x, +r.getAttribute('x') + o.dx + pad, 0.002);
            near(`${tag} card ${i} copy ${c} y`, y, +r.getAttribute('y') + o.dy + pad, 0.002);
          }
          wrote++;
        });
      });
      if (!wrote) fails.push(`${tag}: no outlines written`);
    }

    const matching = {...DEFAULTS, ...cameoPaperLayout('landscape'), pageSize:'letter', silhouette:true};
    for (const change of [{regPattern:4}, {regLen:20}, {regThickness:.5}, {regOrientation:'portrait'}, {regInset:12}]) {
      S.settings = {...matching, ...change};
      let mismatch = '';
      try { await cutStudio3(0); } catch (err) { mismatch = err.message; }
      eq(`${JSON.stringify(change)} rejects a mismatched Studio template`, mismatch, STUDIO3_MARKS_MISMATCH);
    }
    {
      const {regOrientation, ...legacy} = {...matching,...cameoPaperLayout('portrait'),regInset:5.5,regLen:14.3764};
      S.settings = cleanSettings(legacy);
      const oldPortrait = new DataView((await cutStudio3(0)).buffer);
      const [width,height] = man['letter-portrait'].pageOffsets;
      near('saved portrait inset gets a 9 mm wider Studio canvas',oldPortrait.getFloat32(width,true),224.9);
      near('saved portrait inset gets a 9 mm taller Studio canvas',oldPortrait.getFloat32(height,true),288.4);
    }

    // A paper the bases do not cover must refuse rather than write a wrong file.
    S.settings = {...DEFAULTS, pageSize: 'a3', orientation: 'landscape', silhouette: true, guides: 'none'};
    eq('unsupported paper has no base', studio3Key(), null);
    let refused = false;
    try { await cutStudio3(0); } catch { refused = true; }
    eq('unsupported paper refuses', refused, true);
  } catch (e) {
    fails.push(`threw: ${e && e.message}`);
  } finally {
    S.settings = saved;
    try { renderAll(); } catch {}
  }
  return fails.length ? {failed: fails} : true;
})();
