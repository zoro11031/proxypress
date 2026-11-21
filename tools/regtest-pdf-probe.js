// Probe for tools/console-check.js --probe. Runs inside the page.
// Returns true, or an object naming what did not match (which fails the run).
//
// The marks-only test page has to put the registration marks exactly where a
// real export puts them, or it tests nothing. It draws only those marks: no
// images, no guides, no label, and it works with an empty project.
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
      eq(`${tag} no stroked lines`, /\b[lS]\s*$/m.test(ops), false);
      eq(`${tag} filled rectangles`, (ops.match(/ re\b/g) || []).length, ink.length);
      ran++;
    }
    eq('cases ran', ran > 6, true);
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
