(() => {
  const failed = [], oldPrinter = S.printer;
  const eq = (name,a,b) => { if (a !== b) failed.push(`${name}: ${a} != ${b}`); };
  try {
    S.printer = 'et2800';
    const raw = {...DEFAULTS, silhouette:false, margin:12, bleed:3, cols:3, rows:2, orientation:'landscape', pageSize:'letter'};
    const clean = cleanSettings(raw);
    for (const key of ['margin','bleed','cols','rows']) eq(`custom ${key} survives reload`, clean[key],raw[key]);
    const invalid = cleanSettings({...DEFAULTS, backs:'false', dpi:123, pageW:0, cardW:-2, scaleX:0, cols:2.7, rows:-1, jpeg:150});
    eq('false string is not true',invalid.backs,false);
    eq('unknown DPI falls back',invalid.dpi,DEFAULTS.dpi);
    eq('zero page width falls back',invalid.pageW,DEFAULTS.pageW);
    eq('negative card width falls back',invalid.cardW,DEFAULTS.cardW);
    eq('zero scale falls back',invalid.scaleX,DEFAULTS.scaleX);
    eq('fractional columns become integer',invalid.cols,2);
    eq('negative rows become auto',invalid.rows,0);
    eq('JPEG bounded to field maximum',invalid.jpeg,100);
  } finally { S.printer = oldPrinter; }
  return failed.length ? {failed} : true;
})();
