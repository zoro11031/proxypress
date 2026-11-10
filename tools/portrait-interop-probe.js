// Verify exported PDFs and cut files contain nine full-size cards with clear registration marks on portrait sheets
(async () => {
  const failed = [];
  const eq = (name, got, want) => {
    if (got !== want) failed.push(`${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
  };
  const near = (name, got, want, eps = 0.05) => {
    if (Math.abs(got - want) > eps) failed.push(`${name}: got ${got} want ${want} (diff ${Math.abs(got - want)})`);
  };

  const originalS = JSON.parse(JSON.stringify(S));
  const oldDownload = download;
  const oldNewDoc = newDoc;
  let imageKey = null;

  try {
    // Create a dummy card image
    const canvas = document.createElement('canvas');
    canvas.width = 63; canvas.height = 88;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#123456';
    ctx.fillRect(0, 0, 63, 88);
    imageKey = await storeImage(await new Promise(r => canvas.toBlob(r, 'image/png')));
    const face = {name: 'Test Card', custom: imageKey};

    const d = {id: uid(), name: 'Portrait-9-Test', entries: [], updated: Date.now()};
    S.decks.push(d);
    S.deckId = d.id;

    for (const printer of ['et2800', 'mf753']) {
      S.printer = printer;

      for (const presetId of ['b-letter', 'b-a4']) {
        const paper = presetId === 'b-a4' ? 'a4' : 'letter';

        // 1. Silhouette Cameo mode
        S.settings = {...DEFAULTS};
        renderAll();
        $('#btnCutModeCameo').click();
        $(`#presetGrid [data-preset="${presetId}"]`).click();

        const L_cam = layout();
        eq(`${printer} ${presetId} cameo cols`, L_cam.cols, 3);
        eq(`${printer} ${presetId} cameo rows`, L_cam.rows, 3);
        eq(`${printer} ${presetId} cameo per`, L_cam.per, 9);
        eq(`${printer} ${presetId} cameo fits`, L_cam.fits, true);
        eq(`${printer} ${presetId} cameo cardW`, S.settings.cardW, 63);
        eq(`${printer} ${presetId} cameo cardH`, S.settings.cardH, 88);
        eq(`${printer} ${presetId} cameo no regConflict`, regConflict(L_cam), false);

        // Check registration marks geometry
        const marks = regMarks(L_cam);
        eq(`${printer} ${presetId} cameo mark rect count`, marks.rects.length, 1);
        const [sqX, sqY, sqW, sqH] = marks.rects[0];
        near(`${printer} ${presetId} cameo square X`, sqX, S.settings.regInset);
        near(`${printer} ${presetId} cameo square Y`, sqY, S.settings.regInset);
        near(`${printer} ${presetId} cameo square W`, sqW, 5);
        near(`${printer} ${presetId} cameo square H`, sqH, 5);

        // Ensure square does not intersect any card
        for (let i = 0; i < 9; i++) {
          const pos = slotPos(L_cam, i, false);
          const cardX1 = pos.x + S.settings.bleed, cardY1 = pos.y + S.settings.bleed;
          const cardX2 = cardX1 + L_cam.cw, cardY2 = cardY1 + L_cam.ch;
          const sqX2 = sqX + sqW, sqY2 = sqY + sqH;
          const overlap = !(sqX2 <= cardX1 || sqX >= cardX2 || sqY2 <= cardY1 || sqY >= cardY2);
          eq(`${printer} ${presetId} cameo sq overlaps card ${i}`, overlap, false);
        }

        // Test 9-card deck cut SVG
        d.entries = [{uid: uid(), name: 'Card', qty: 9, faces: [face, face], tokens: []}];
        const svg = cutSvg(0);
        const xml = new DOMParser().parseFromString(svg, 'image/svg+xml');
        const rects = xml.querySelectorAll('rect');
        eq(`${printer} ${presetId} cutSvg rect count`, rects.length, 9);
        for (let i = 0; i < rects.length; i++) {
          const r = rects[i];
          near(`${printer} ${presetId} cutSvg rect ${i} width`, +r.getAttribute('width'), 63);
          near(`${printer} ${presetId} cutSvg rect ${i} height`, +r.getAttribute('height'), 88);
          near(`${printer} ${presetId} cutSvg rect ${i} rx`, +r.getAttribute('rx'), 3.2);
          near(`${printer} ${presetId} cutSvg rect ${i} ry`, +r.getAttribute('ry'), 3.2);
          const pos = slotPos(L_cam, i, false);
          near(`${printer} ${presetId} cutSvg rect ${i} x`, +r.getAttribute('x'), pos.x + S.settings.bleed);
          near(`${printer} ${presetId} cutSvg rect ${i} y`, +r.getAttribute('y'), pos.y + S.settings.bleed);
        }

        // Test PDF export with backs
        let pdfPages = 0, pdfDoc = null;
        newDoc = (...args) => {
          pdfDoc = oldNewDoc(...args);
          pdfDoc.save = () => {
            pdfPages = pdfDoc.getNumberOfPages();
          };
          return pdfDoc;
        };
        await exportPDF(true);
        closeModal(true);
        eq(`${printer} ${presetId} cameo PDF page count`, pdfPages, 2);

        // Test 10-card deck (multi-sheet: 9 + 1)
        d.entries = [{uid: uid(), name: 'Card', qty: 10, faces: [face, face], tokens: []}];
        const svgSheet0 = cutSvg(0);
        const xml0 = new DOMParser().parseFromString(svgSheet0, 'image/svg+xml');
        eq(`${printer} ${presetId} 10-card sheet 0 rect count`, xml0.querySelectorAll('rect').length, 9);
        const svgSheet1 = cutSvg(1);
        const xml1 = new DOMParser().parseFromString(svgSheet1, 'image/svg+xml');
        eq(`${printer} ${presetId} 10-card sheet 1 rect count`, xml1.querySelectorAll('rect').length, 1);

        pdfPages = 0;
        await exportPDF(true);
        closeModal(true);
        eq(`${printer} ${presetId} 10-card cameo PDF page count`, pdfPages, 4);

        // 2. Rotary Trimmer mode
        $('#btnCutModeRotary').click();
        $(`#presetGrid [data-preset="${presetId}"]`).click();

        const L_rot = layout();
        eq(`${printer} ${presetId} rotary cols`, L_rot.cols, 3);
        eq(`${printer} ${presetId} rotary rows`, L_rot.rows, 3);
        eq(`${printer} ${presetId} rotary per`, L_rot.per, 9);
        eq(`${printer} ${presetId} rotary fits`, L_rot.fits, true);
        eq(`${printer} ${presetId} rotary cardW`, S.settings.cardW, 63);
        eq(`${printer} ${presetId} rotary cardH`, S.settings.cardH, 88);

        // Cut guides should be drawn
        const guides = guideLines(L_rot, 9);
        eq(`${printer} ${presetId} rotary guides non-empty`, guides.length > 0, true);

        // PDF export in rotary mode
        pdfPages = 0;
        await exportPDF(true);
        closeModal(true);
        eq(`${printer} ${presetId} rotary PDF page count`, pdfPages, 4);
      }
    }
  } catch (err) {
    failed.push('Exception: ' + (err.stack || err.message));
  } finally {
    newDoc = oldNewDoc;
    download = oldDownload;
    closeModal(true);
    Object.assign(S, originalS);
    if (imageKey) await removeImageIfUnused(imageKey);
    renderAll();
  }

  return failed.length ? {failed} : true;
})();
