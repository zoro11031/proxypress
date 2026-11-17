// Probe for tools/console-check.js --probe. Runs inside the page.
// Returns true, or an object naming what did not match (which fails the run).
//
// Silhouette Studio's free Basic edition refuses SVG ("The file type you are
// attempting to access is not supported"), so the DXF is the cut file that
// actually reaches a cutter. These assertions cover the three things that are
// only in the DXF writer and so are not protected by the SVG interop probes:
// the Y flip into DXF's bottom-left origin, the bulge-encoded corners, and the
// header that states millimetres so the importer does not guess.
(() => {
  const fails = [];
  const eq = (name, got, want) => { if (got !== want) fails.push(`${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); };
  const near = (name, got, want, tol = 0.01) => { if (!(Math.abs(got - want) <= tol)) fails.push(`${name}: got ${got} want ${want} +-${tol}`); };
  const saved = JSON.parse(JSON.stringify(S.settings));

  // (code, value) pairs, which is all a DXF is.
  const pairs = text => {
    const lines = text.split('\n'), out = [];
    for (let i = 0; i + 1 < lines.length; i += 2) out.push([lines[i].trim(), lines[i + 1]]);
    return out;
  };
  const headerVar = (ps, name) => {
    const i = ps.findIndex(([c, v]) => c === '9' && v === name);
    return i < 0 ? null : ps.slice(i + 1, i + 4).filter(([c]) => c !== '9');
  };
  // One entry per POLYLINE: its vertices as {x, y, bulge} and its closed flag.
  const polylines = ps => {
    const out = [];
    let cur = null;
    for (let i = 0; i < ps.length; i++) {
      const [c, v] = ps[i];
      if (c === '0' && v === 'POLYLINE') { cur = {closed: null, verts: []}; out.push(cur); }
      else if (c === '0' && v === 'VERTEX' && cur) cur.verts.push({x: null, y: null, bulge: 0});
      else if (c === '0' && v === 'SEQEND') cur = null;
      else if (cur) {
        const vert = cur.verts[cur.verts.length - 1];
        if (c === '70' && !cur.verts.length) cur.closed = +v;
        else if (vert && c === '10') vert.x = +v;
        else if (vert && c === '20') vert.y = +v;
        else if (vert && c === '42') vert.bulge = +v;
      }
    }
    return out;
  };

  try {
    for (const paper of ['letter', 'a4']) for (const orientation of ['landscape', 'portrait']) {
      S.settings = {...DEFAULTS, pageSize: paper, orientation, silhouette: true, guides: 'none',
        ...cameoPaperLayout(orientation)};
      const L = layout(), tag = `${paper}/${orientation}`;
      const pad = orientation === 'portrait' ? 6.5 : 0;
      const ps = pairs(cutDxf(0));

      // Header: units stated, extents are the sheet.
      eq(`${tag} $INSUNITS`, (headerVar(ps, '$INSUNITS') || [])[0]?.[1], '4');
      eq(`${tag} $MEASUREMENT`, (headerVar(ps, '$MEASUREMENT') || [])[0]?.[1], '1');
      const ext = headerVar(ps, '$EXTMAX') || [];
      near(`${tag} $EXTMAX x`, +(ext[0] || [])[1], L.W+2*pad);
      near(`${tag} $EXTMAX y`, +(ext[1] || [])[1], L.H+2*pad);

      // One closed polyline per card, matching the SVG the same call would write.
      const polys = polylines(ps);
      const rects = Array.from(new DOMParser().parseFromString(cutSvg(0), 'image/svg+xml').querySelectorAll('rect'));
      eq(`${tag} card count`, polys.length, rects.length);
      eq(`${tag} cards on sheet`, polys.length, L.per);

      polys.forEach((p, i) => {
        eq(`${tag} card ${i} closed`, p.closed, 1);
        eq(`${tag} card ${i} vertex count`, p.verts.length, 8);
        eq(`${tag} card ${i} bulge count`, p.verts.filter(v => v.bulge).length, 4);
        p.verts.filter(v => v.bulge).forEach((v, j) => near(`${tag} card ${i} bulge ${j}`, v.bulge, Math.tan(Math.PI / 8), 1e-5));

        const xs = p.verts.map(v => v.x), ys = p.verts.map(v => v.y);
        const x = Math.min(...xs), y = Math.min(...ys);
        const w = Math.max(...xs) - x, h = Math.max(...ys) - y;
        const r = rects[i], sx = +r.getAttribute('x'), sy = +r.getAttribute('y');
        const sw = +r.getAttribute('width'), sh = +r.getAttribute('height'), rad = +r.getAttribute('rx');

        near(`${tag} card ${i} width`, w, sw);
        near(`${tag} card ${i} height`, h, sh);
        near(`${tag} card ${i} x`, x, sx+pad);
        // The Y flip: DXF counts up from the bottom, the SVG down from the top.
        near(`${tag} card ${i} y flipped`, y, L.H + pad - sy - sh);

        // Corners must round INTO the card. A flipped bulge sign still draws
        // four arcs of the right radius, just bulging outward into little ears,
        // so the radius alone would not catch it -- place the arcs instead.
        // Arc midpoint for a bulge b over chord d is chordMid + (b/2)*(dy, -dx).
        const k = Math.SQRT1_2;
        const want = [
          [x + w - rad + rad * k, y + rad - rad * k],   // bottom-right
          [x + w - rad + rad * k, y + h - rad + rad * k], // top-right
          [x + rad - rad * k, y + h - rad + rad * k],   // top-left
          [x + rad - rad * k, y + rad - rad * k]        // bottom-left
        ];
        let seen = 0;
        p.verts.forEach((v, j) => {
          if (!v.bulge) return;
          const n = p.verts[(j + 1) % p.verts.length];
          const dx = n.x - v.x, dy = n.y - v.y;
          const mx = (v.x + n.x) / 2 + (v.bulge / 2) * dy;
          const my = (v.y + n.y) / 2 - (v.bulge / 2) * dx;
          near(`${tag} card ${i} corner ${seen} arc x`, mx, want[seen][0]);
          near(`${tag} card ${i} corner ${seen} arc y`, my, want[seen][1]);
          seen++;
        });
      });
    }

    // Fixed registration marks anchor the calibrated artwork and cut paths.
    S.settings = {...DEFAULTS, pageSize: 'letter', orientation: 'landscape', silhouette: true,
      guides: 'none', ...cameoPaperLayout('landscape'), offsetX: 1.5, offsetY: -0.8};
    {
      const L = layout(), p = slotPos(L, 0, false);
      const poly = polylines(pairs(cutDxf(0)))[0];
      near('cut x follows the artwork', Math.min(...poly.verts.map(v => v.x)), p.x + S.settings.bleed + 1.5);
      near('cut y follows the artwork', Math.max(...poly.verts.map(v => v.y)), L.H - p.y - S.settings.bleed + 0.8);
      S.settings.regOrientation = 'portrait';
      const turned = polylines(pairs(cutDxf(0)))[0];
      near('portrait mat rotates corrected x',Math.min(...turned.verts.map(v=>v.x)),L.H-p.y-S.settings.bleed-L.ch+0.8);
      near('portrait mat rotates corrected y',Math.max(...turned.verts.map(v=>v.y)),L.W-p.x-S.settings.bleed-1.5);
    }

    // A sheet that does not exist is an error, not an empty file.
    try { cutDxf(100); fails.push('invalid sheet accepted'); } catch {}
  } catch (e) {
    fails.push(`threw: ${e && e.message}`);
  } finally {
    S.settings = saved;
    try { renderAll(); } catch {}
  }
  return fails.length ? {failed: fails} : true;
})();
