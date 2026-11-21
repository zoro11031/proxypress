// Probe for tools/console-check.js --probe. Runs inside the page.
// Returns true, or an object naming what did not match (which fails the run).
//
// The registration test page has to put the registration marks exactly where a
// real export puts them, or it tests nothing. Besides the marks it draws only a
// faint, thin pure-black outline of each card position (bleed edge and safe area), placed
// where the export places the card art: no images, no guides, no label, and it
// works with an empty project.
(() => {
  const fails = [];
  const eq = (name, got, want) => { if (got !== want) fails.push(`${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); };
  const saved = JSON.parse(JSON.stringify(S.settings));
  try {
    eq('buttons present', !!$('#btnRegTestPdf') && !!$('#btnRegTestPdfTab'), true);
    eq('tab button not tied to cards', $('#btnRegTestPdfTab').disabled, false);
    const cases = [];
    for (const paper of ['letter', 'a4']) for (const orientation of ['landscape', 'portrait'])
      for (const template of ['standard', 'custom']) for (const pattern of [3, 4])
        cases.push({paper, orientation, template, pattern});
    let ran = 0;
    for (const c of cases) {
      if (c.template === 'standard' && c.pattern === 4) continue;
      S.settings = {...DEFAULTS, pageSize: c.paper, orientation: c.orientation, silhouette: true, guides: 'none',
        ...cameoPaperLayout(c.orientation), scmTemplate: c.template, regPattern: c.pattern, scmLabel: 'should not print'};
      const L = layout(), s = S.settings, tag = `${c.paper}/${c.orientation}/${c.template}/${c.pattern}`;
      if (c.template === 'standard' && !L.scm) continue;
      const {doc, ink} = registrationTestDoc(L, s);
      const want = regInkBoxes(regMarks(L, s));
      eq(`${tag} same ink as export`, JSON.stringify(ink), JSON.stringify(want));
      eq(`${tag} mark count`, ink.length, c.pattern === 4 ? 8 : 5);
      eq(`${tag} one page`, doc.getNumberOfPages(), 1);
      const size = doc.internal.pageSize;
      eq(`${tag} page size`, `${size.getWidth().toFixed(2)}x${size.getHeight().toFixed(2)}`, `${L.W.toFixed(2)}x${L.H.toFixed(2)}`);
      // The written file is deflated; read the page's own operator list.
      const ops = doc.internal.pages[1].join('\n');
      eq(`${tag} no images in file`, /\/Subtype\s*\/Image/.test(doc.output()), false);
      eq(`${tag} no images drawn`, /\bDo\b/.test(ops), false);
      eq(`${tag} no text`, /\bBT\b/.test(ops), false);
      eq(`${tag} filled rectangles`, (ops.match(/ re\s+f\b/g) || []).length, ink.length);
      // Everything is pure black, so a colour laser can print it from the black
      // cartridge alone: no grey, no colour, no CMYK that a converter could
      // turn into a four-toner mix. jsPDF writes black as "0. g" / "0. G".
      const colours = [...ops.matchAll(/^(.*?)\s*(rg|RG|g|G|k|K|sc|SC|scn|SCN)$/gm)].map(m => m[0]);
      eq(`${tag} only pure black`, colours.filter(c => !/^0\.?0*( 0\.?0*){0,2} (rg|RG|g|G)$/.test(c)).join(' | '), '');
      eq(`${tag} outline width`, /^0\.28\d* w$/m.test(ops) || ops.includes((REG_TEST_LINE * 72 / 25.4).toFixed(2) + ' w'), true);
      const {outlines} = registrationTestDoc(L, s);
      eq(`${tag} one outline per position`, outlines.length, L.per);
      const strokes = (ops.match(/\bS\s*$/gm) || []).length;
      eq(`${tag} stroke count`, strokes, outlines.length + outlines.filter(o => o.safe).length);
      // The bleed outline is exactly the card art's rectangle in the export.
      const T = makeT(L, false, s), round = a => a.map(v => v.toFixed(4)).join(',');
      for (let i = 0; i < L.per; i++) {
        const p2 = slotPos(L, i, false, s);
        eq(`${tag} slot ${i} bleed`, round(outlines[i].bleed), round([T.x(p2.x), T.y(p2.y), T.w(L.sw), T.h(L.sh)]));
        const [x, y, w, h] = outlines[i].safe, b = outlines[i].bleed, side = (b[2] - w) / 2, top = (b[3] - h) / 2;
        eq(`${tag} slot ${i} safe centred`, [x - b[0], y - b[1]].map(v => v.toFixed(4)).join(','), [side, top].map(v => v.toFixed(4)).join(','));
        eq(`${tag} slot ${i} safe inset`, side.toFixed(4), (s.bleed + REG_TEST_SAFE).toFixed(4));
      }
      ran++;
    }
    eq('cases ran', ran > 6, true);
    // A calibration offset moves the outlines with the card art.
    S.settings = {...DEFAULTS, pageSize: 'letter', orientation: 'landscape', silhouette: true, guides: 'none', ...cameoPaperLayout('landscape'), scmTemplate: 'custom'};
    const L0 = layout(), base0 = registrationTestDoc(L0, S.settings);
    S.settings = {...S.settings, offsetX: 1.5, offsetY: -0.75};
    const moved = registrationTestDoc(layout(), S.settings);
    eq('offset moves outlines', (moved.outlines[0].bleed[0] - base0.outlines[0].bleed[0]).toFixed(3) + ',' + (moved.outlines[0].bleed[1] - base0.outlines[0].bleed[1]).toFixed(3), '1.500,-0.750');
    eq('offset marks match export', JSON.stringify(moved.ink), JSON.stringify(regInkBoxes(regMarks(layout(), S.settings))));
    S.settings = {...DEFAULTS, silhouette: false};
    let toastText = '';
    const realToast = window.toast;
    try { window.toast = m => { toastText = m; }; exportRegistrationTest(); } finally { window.toast = realToast; }
    eq('refuses without marks', /Silhouette cutter/.test(toastText), true);
  } catch (e) {
    fails.push('threw: ' + (e && e.stack || e));
  } finally {
    S.settings = saved;
  }
  return fails.length ? {fails} : true;
})();
