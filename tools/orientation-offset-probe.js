// Probe for tools/console-check.js --probe, paired with --artifacts.
// Measures what the four offset fields actually do to an exported card PDF, in
// both page orientations, by exporting through the real export path and keeping
// the bytes. Returns true when every export was produced; the measurements go to
// window.__probeArtifacts for tools/offset-frames.py to read.
//
// Nothing here fits a transform to the result: each export is compared with its
// own baseline image by image, so a sign error cannot be absorbed.
(async () => {
  const out = {runs: [], notes: []};
  const saved = {settings: S.settings, decks: S.decks, deckId: S.deckId};
  // A 2x3 px PNG, enough for renderFace to draw. `custom` keeps it out of the
  // placeholder and MPC paths, which would otherwise ask questions mid-export.
  const b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAIAAAA2iEnWAAAAEUlEQVR4nGP4z8DwnwGMERQARNAF+7BYSawAAAAASUVORK5CYII=';
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const png = 'probe-card-image';
  // `custom` is a key into the image store; seeding the blob-URL cache is enough
  // to make faceSrc resolve it without touching IndexedDB.
  blobUrls.set(png, URL.createObjectURL(new Blob([bytes], {type: 'image/png'})));
  const face = n => ({name: n, custom: png});
  const deckObj = {id: 'probe-deck', name: 'probe', entries: [1, 2, 3, 4].map(i =>
    ({id: 'e' + i, name: 'Card ' + i, qty: 1, kind: 'CARD', faces: [face('Card ' + i)]})), cardback: null};
  const real = window.jspdf.jsPDF;
  let last = null;
  window.jspdf = Object.assign({}, window.jspdf, {jsPDF: function (...a) {
    const d = new real(...a);
    d.save = () => { last = d.output('datauristring').split(',')[1]; return d; };
    return d;
  }});
  const BASE = over => ({...DEFAULTS, pageSize: 'letter', cardRotation: 'upright', bleed: 2, margin: 5,
    duplexFlip: 'long', backs: true, backImage: png, dfcMode: 'duplex', guides: 'none',
    dpi: 72, jpeg: 40, silhouette: false, showCuts: false, ...over});
  const run = async (label, over) => {
    S.decks = [deckObj]; S.deckId = deckObj.id;
    S.settings = BASE(over);
    const L = layout(), Tf = makeT(L, false), Tb = makeT(L, true);
    // What the app's own geometry says, to compare against the drawn bytes.
    // The centre of slot 0's image: a material point that a rotation cannot
    // move out from under the measurement, unlike a bounding-box corner.
    const predict = back => {
      const T = makeT(L, back), p = slotPos(L, 0, back);
      return turnPt(L, {x: T.x(p.x + L.sw / 2), y: T.y(p.y + L.sh / 2)}, back);
    };
    last = null;
    await exportPDF(true);
    if (!last) { out.notes.push(`${label}: no PDF produced`); return; }
    out.runs.push({label, over, pdf: last,
      page: {W: L.W, H: L.H, cols: L.cols, rows: L.rows, per: L.per, mirrorX: L.mirrorX,
             sw: L.sw, sh: L.sh, x0: L.x0, y0: L.y0, rot: L.rot,
             faceRotFront: faceRot(L, false), faceRotBack: faceRot(L, true),
             turnFront: turnAngle(false), turnBack: turnAngle(true)},
      predicted: {front: predict(false), back: predict(true),
                  frontSlot0: slotPos(L, 0, false), backSlot0: slotPos(L, 0, true),
                  Tf0: {x: Tf.x(0), y: Tf.y(0)}, Tb0: {x: Tb.x(0), y: Tb.y(0)}}});
  };
  // The two calibration sheets, with every calibration term non-zero, so the
  // drawn marks and the sheet's own machine-readable key can be checked against
  // the transform the card exporter used on the same settings.
  const sheet = async (label, over, btn) => {
    S.decks = [deckObj]; S.deckId = deckObj.id;
    S.settings = BASE(over);
    const L = layout(), T = makeT(L, false), inset = duplexTestInset(L);
    const pt = (x, y, back = false) => { const t = makeT(L, back); return turnPt(L, {x: t.x(x), y: t.y(y)}, back); };
    last = null;
    document.querySelector(btn).click();
    await sleep(0);
    if (!last) { out.notes.push(`${label}: no PDF produced`); return; }
    const corners = [[10, 10], [L.W - 10, 10], [10, L.H - 10], [L.W - 10, L.H - 10]];
    const dt = duplexTestPoints(L, inset);
    out.runs.push({label, over, pdf: last,
      page: {W: L.W, H: L.H, mirrorX: L.mirrorX, inset},
      // Computed with the same makeT/turnPt the card exporter uses, from the same
      // settings object: a drawn mark that disagrees with these is a drawing-stage
      // bug, and a key that disagrees is a stale key.
      expect: {crosses: corners.map(([x, y]) => pt(x, y)),
               dot: pt(10, 25),
               slot0Front: pt(slotPos(L, 0, false).x, slotPos(L, 0, false).y),
               slot0Back: pt(slotPos(L, 0, true).x, slotPos(L, 0, true).y, true),
               marks: dt.marks, holes: dt.holes}});
  };
  try {
    const deltas = [['base', {}], ['offsetX+1', {offsetX: 1}], ['offsetY+1', {offsetY: 1}],
                    ['backOffsetX+1', {backOffsetX: 1}], ['backOffsetY+1', {backOffsetY: 1}]];
    for (const orientation of ['landscape', 'portrait']) {
      for (const [name, d] of deltas) await run(`${orientation}/${name}`, {orientation, ...d});
      // Again with the provisional rotations live, to pin the transform order.
      for (const [name, d] of deltas)
        await run(`${orientation}/rot/${name}`, {orientation, printRotate: -0.21, backRotate: -0.62, ...d});
      const live = {orientation, offsetX: 1, offsetY: 0.5, backOffsetX: -2.8, backOffsetY: -2.2,
                    printRotate: -0.21, backRotate: -0.62};
      await run(`${orientation}/live/cards`, live);
      await sheet(`${orientation}/live/align`, live, '#btnCal');
      await sheet(`${orientation}/live/duplex`, live, '#btnDuplexTest');
    }
  } catch (e) {
    out.notes.push('threw: ' + (e && e.message));
  } finally {
    window.jspdf = Object.assign({}, window.jspdf, {jsPDF: real});
    S.settings = saved.settings; S.decks = saved.decks; S.deckId = saved.deckId;
  }
  window.__probeArtifacts = out;
  return out.notes.length ? {failed: out.notes} : true;
})()
