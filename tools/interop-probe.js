// Optional artifact capture: --artifacts /tmp/proxypress-interop.json
(async () => {
  const original = JSON.parse(JSON.stringify(S)), oldDownload = download, oldNewDoc = newDoc;
  let imageKey;
  const failed = [], artifacts = [], downloads = [];
  const check = (ok, message) => { if (!ok) failed.push(message); };
  const near = (a, b) => Math.abs(a - b) < 0.002;
  try {
    const canvas = document.createElement('canvas'); canvas.width = 63; canvas.height = 88;
    canvas.getContext('2d').fillRect(0, 0, 63, 88);
    imageKey = await storeImage(await new Promise(r => canvas.toBlob(r, 'image/png')));
    const face = {name:'Local test', custom:imageKey};
    const d = {id:uid(), name:'Interop', entries:[], updated:Date.now()};
    S.decks.push(d); S.deckId = d.id;
    download = (blob, name) => downloads.push({blob, name});
    for (const [orientation, per, counts, sets] of [
      ['landscape', 8, [1, 8, 9, 16], {orientation:'landscape', cols:4, rows:2, margin:10, bleed:0.625}],
      ['portrait', 9, [1, 9, 10, 18], {orientation:'portrait', cols:3, rows:3, margin:5, bleed:0.5, regInset:5.5, regLen:0}]
    ]) for (const paper of ['letter', 'a4']) for (const count of counts) {
      S.settings = {...DEFAULTS, pageSize:paper, cardRotation:'upright', gap:0, silhouette:true, guides:'none', dpi:72, ...sets};
      d.entries = [{uid:uid(), name:'Local test', qty:count, faces:[face, face], tokens:[]}];
      const L = layout(), pages = Math.ceil(count / per), svgs = [];
      check(L.per === per, `${paper}/${orientation} capacity`);
      check(!regConflict(L), `${paper}/${orientation} marks clear`);
      for (let sheet = 0; sheet < pages; sheet++) {
        const svg = cutSvg(sheet), xml = new DOMParser().parseFromString(svg, 'image/svg+xml');
        check(xml.querySelectorAll('rect').length === Math.min(per, count - sheet * per), `${paper}/${orientation}/${count}/${sheet} occupancy`);
        svgs.push(svg);
      }
      downloadCutSvg();
      if (pages > 1) { $('#cutSheet').value = String(pages - 1); $('#cutSheetExport').click(); }
      check(downloads.at(-1).name === (pages === 1 ? 'cut-lines.svg' : `cut-lines-sheet-${pages}.svg`), 'sheet filename');
      let pdf;
      newDoc = (...args) => { const doc = oldNewDoc(...args); doc.save = () => { pdf = doc.output('datauristring').split(',')[1]; check(doc.getNumberOfPages() === pages * 2, 'front/back page count'); }; return doc; };
      await exportPDF(); closeModal(true);
      check(!!pdf, 'PDF exported');
      artifacts.push({paper, orientation, count, arm:regArm(L), svgs, pdf});
    }
    S.settings.scaleX = 99; S.settings.scaleY = 101; S.settings.offsetX = 2; S.settings.offsetY = -3;
    const L = layout(), p = slotPos(L, 0, false), rect = new DOMParser().parseFromString(cutSvg(), 'image/svg+xml').querySelector('rect');
    const num = key => +rect.getAttribute(key);
    check(near(num('x'), L.W/2 + (p.x + S.settings.bleed - L.W/2)*0.99 + 2), 'X compensation applied once');
    check(near(num('y'), L.H/2 + (p.y + S.settings.bleed - L.H/2)*1.01 - 3), 'Y compensation applied once');
    check(near(num('width'), 63*0.99) && near(num('height'), 88*1.01), 'scaled card dimensions');
    check(near(num('rx'), 3.2*0.99) && near(num('ry'), 3.2*1.01), 'scaled corner axes');
    S.settings.cardRotation = 'rotated';
    const rotated = new DOMParser().parseFromString(cutSvg(), 'image/svg+xml').querySelector('rect');
    check(near(+rotated.getAttribute('width'), 88*0.99) && near(+rotated.getAttribute('height'), 63*1.01), 'rotated card dimensions');
    try { cutSvg(100); failed.push('invalid sheet accepted'); } catch {}
    window.__probeArtifacts = artifacts;
  } catch (e) { failed.push(e.stack); }
  finally { newDoc = oldNewDoc; download = oldDownload; closeModal(true); Object.assign(S, original); if (imageKey) await removeImageIfUnused(imageKey); renderAll(); }
  return failed.length ? {failed} : true;
})();
