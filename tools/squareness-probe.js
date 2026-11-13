// Probe for tools/console-check.js --probe. Runs inside the page.
// Returns true, or an object naming what did not match (which fails the run).
//
// Covers the squareness gauge's geometry and its skew arithmetic: the corner
// span and degrees-per-millimetre for each orientation, that nothing is drawn
// or printed inside the printer's 5 mm non-printable margin, that every label
// names the tick it sits against, and that pages too small to carry the gauge
// get no gauge rather than overlapping marks.
(() => {
  const fails = [];
  const eq = (n, got, want) => { if (got !== want) fails.push(`${n}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); };
  const saved = S.settings;
  // The sheet draws labels at 5.5 pt. A glyph box wide enough to be safe: the
  // anchor alone says nothing about whether the printed text clears the edge.
  const ASC = 1.5, DESC = 0.4, CHAR = 1.1;
  const glyph = ([x, y, txt, align]) => {
    const w = txt.length * CHAR;
    const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    return {x0, x1: x0 + w, y0: y - ASC, y1: y + DESC, cx: x0 + w / 2, cy: y - (ASC - DESC) / 2};
  };
  try {
    S.settings = {...DEFAULTS, pageSize:'letter', orientation:'landscape'};
    let L = layout(), m = squarenessMarks(L);
    eq('band', m.band, 6);
    eq('scale span', [m.scale.from, m.scale.to, m.scale.step].join(), '5,15,0.5');
    // The scales are the instrument the reader sights against, so the conversion
    // has to be reckoned between the scales. Reckoning it between the corner
    // crosses (259.4 mm) overstates the angle by 6.6%.
    eq('landscape span x', +m.span.x.toFixed(1), 243.4);
    eq('landscape span y', +m.span.y.toFixed(1), 179.9);
    eq('landscape deg/mm x', +m.degPerMm.x.toFixed(4), 0.2354);
    eq('landscape deg/mm y', +m.degPerMm.y.toFixed(4), 0.3185);
    eq('worked example', +(1.588 * m.degPerMm.x).toFixed(3), 0.374);
    // The blank-sheet diagonal check is a figure per paper size, not a constant.
    eq('letter landscape third of a degree', +m.thirdDeg.toFixed(2), 1.99);

    // Portrait swaps the spans; a conversion hard-coded to landscape fails here.
    S.settings = {...DEFAULTS, pageSize:'letter', orientation:'portrait'};
    L = layout(); m = squarenessMarks(L);
    eq('portrait span x', +m.span.x.toFixed(1), 179.9);
    eq('portrait span y', +m.span.y.toFixed(1), 243.4);

    // Nothing may be drawn inside the 5 mm non-printable margin, on any edge.
    eq('clears 5mm margin', m.lines.every(([x1, y1, x2, y2]) =>
      Math.min(x1, x2) >= 5 - 1e-9 && Math.min(y1, y2) >= 5 - 1e-9 &&
      Math.max(x1, x2) <= L.W - 5 + 1e-9 && Math.max(y1, y2) <= L.H - 5 + 1e-9), true);
    // Axis-alignment alone does not tell a margin line from a tick: both are
    // horizontal or vertical. Length does, and the drawing relies on the order.
    const len = ([x1, y1, x2, y2]) => Math.hypot(x2 - x1, y2 - y1);
    eq('margin lines first', m.lines.slice(0, 4).every(l => len(l) > 50), true);
    eq('ticks follow, and are short', m.lines.length > 4 && m.lines.slice(4).every(l => len(l) <= 3 + 1e-9), true);

    // Labels come from the same place as the ticks, so the two cannot drift apart.
    eq('two labels per scale, eight scales', m.labels.length, 16);
    eq('labels are the labelled values', [...new Set(m.labels.map(l => l[2]))].sort().join(), '10,15');
    // The anchor is not what gets printed. Check the glyph box.
    eq('printed labels clear the margin', m.labels.every(l => {
      const g = glyph(l);
      return g.x0 >= 5 && g.y0 >= 5 && g.x1 <= L.W - 5 && g.y1 <= L.H - 5;
    }), true);
    // A label that does not line up with its own tick names the wrong one. The
    // scale pitch is 0.5 mm, so half a pitch of slop is already a misreading.
    const near = (v, opts) => opts.reduce((b, o) => Math.abs(o - v) < Math.abs(b - v) ? o : b, opts[0]);
    const offBy = m.labels.map(l => {
      const g = glyph(l), v = +l[2];
      return l[3] === 'center'
        ? Math.abs(g.cx - near(g.cx, [v, L.W - v]))   // scale across an edge: tick at x = v
        : Math.abs(g.cy - near(g.cy, [v, L.H - v]));  // scale down an edge: tick at y = v
    });
    eq('every label is centred on its tick', Math.max(...offBy) <= 0.5, true);

    // A6 must still fit without opposing scales meeting.
    S.settings = {...DEFAULTS, pageSize:'a6', orientation:'portrait'};
    eq('a6 fits', squarenessMarks(layout()) !== null, true);
    // The diagonal figure follows the paper, so A6 must not report Letter's.
    eq('a6 third of a degree differs', +squarenessMarks(layout()).thirdDeg.toFixed(2), 1);

    // A page with no room omits the gauge rather than drawing overlapping marks.
    // The scales sit 18 mm in from each edge, so 44 mm is already too small -
    // a gate set by the scale range alone (38 mm) lets this through.
    S.settings = {...DEFAULTS, pageSize:'custom', pageW:44, pageH:44};
    eq('44 mm page omitted', squarenessMarks(layout()), null);
    S.settings = {...DEFAULTS, pageSize:'custom', pageW:38, pageH:38};
    eq('tiny page omitted', squarenessMarks(layout()), null);
  } catch (e) { fails.push(`threw: ${e && e.message}`); }
  finally { S.settings = saved; renderAll(); }
  return fails.length ? {fails} : true;
})()
