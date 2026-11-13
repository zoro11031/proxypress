// Probe for tools/console-check.js --probe. Runs inside the page.
// Returns true, or an object naming what did not match (which fails the run).
//
// Covers the squareness gauge's geometry and its skew arithmetic: the corner
// span and degrees-per-millimetre for each orientation, that nothing is drawn
// inside the printer's 5 mm non-printable margin, and that pages too small to
// carry the gauge get no gauge rather than overlapping marks.
(() => {
  const fails = [];
  const eq = (n, got, want) => { if (got !== want) fails.push(`${n}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); };
  const saved = S.settings;
  try {
    S.settings = {...DEFAULTS, pageSize:'letter', orientation:'landscape'};
    let L = layout(), m = squarenessMarks(L);
    eq('band', m.band, 6);
    eq('scale span', [m.scale.from, m.scale.to, m.scale.step].join(), '5,15,0.5');
    eq('landscape span x', +m.span.x.toFixed(1), 259.4);
    eq('landscape span y', +m.span.y.toFixed(1), 195.9);
    eq('landscape deg/mm x', +m.degPerMm.x.toFixed(4), 0.2209);
    eq('landscape deg/mm y', +m.degPerMm.y.toFixed(4), 0.2925);
    // The user's measured 1.588 mm must come back as the 0.351 deg in the spec.
    eq('worked example', +(1.588 * m.degPerMm.x).toFixed(3), 0.351);

    // Portrait swaps the spans; a conversion hard-coded to landscape fails here.
    S.settings = {...DEFAULTS, pageSize:'letter', orientation:'portrait'};
    L = layout(); m = squarenessMarks(L);
    eq('portrait span x', +m.span.x.toFixed(1), 195.9);
    eq('portrait span y', +m.span.y.toFixed(1), 259.4);

    // Nothing may be drawn inside the 5 mm non-printable margin, on any edge.
    const all = m.lines.flatMap(([x1, y1, x2, y2]) => [[x1, x2], [y1, y2]]);
    eq('clears 5mm margin', m.lines.every(([x1, y1, x2, y2]) =>
      Math.min(x1, x2) >= 5 - 1e-9 && Math.min(y1, y2) >= 5 - 1e-9 &&
      Math.max(x1, x2) <= L.W - 5 + 1e-9 && Math.max(y1, y2) <= L.H - 5 + 1e-9), true);
    eq('margin lines first', m.lines.slice(0, 4).every(([x1, y1, x2, y2]) => x1 === x2 || y1 === y2), true);
    eq('ticks follow', m.lines.length > 4, true);

    // A6 must still fit without opposing scales meeting.
    S.settings = {...DEFAULTS, pageSize:'a6', orientation:'portrait'};
    eq('a6 fits', squarenessMarks(layout()) !== null, true);

    // A page with no room omits the gauge rather than drawing overlapping marks.
    S.settings = {...DEFAULTS, pageSize:'custom', pageW:38, pageH:38};
    eq('tiny page omitted', squarenessMarks(layout()), null);
  } catch (e) { fails.push(`threw: ${e && e.message}`); }
  finally { S.settings = saved; renderAll(); }
  return fails.length ? {fails} : true;
})()
