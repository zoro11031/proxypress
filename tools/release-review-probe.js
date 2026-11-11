// Run with tools/console-check.js --probe. Guards recent tour and export changes.
(async () => {
  const fails = [], originalMode = S.mode, originalApi = mpcApi, originalSearch = mpcSearch, originalSf=sf;
  const eq = (name, got, want) => { if (got !== want) fails.push(`${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); };
  try {
    sf=async()=>({data:[],has_more:false});
    for (const mode of ['print', 'order']) {
      S.mode = mode; applyMode(); openTour();
      for (let i = 1; i <= 3; i++) { $('[data-tour="next"]').click(); eq(`${mode} tour forward ${i}`, tourStep, i); }
      for (let i = 2; i >= 0; i--) { $('[data-tour="back"]').click(); eq(`${mode} tour back ${i}`, tourStep, i); }
      closeModal(true);
    }
    S.mode = 'order'; applyMode(); switchTab('order'); renderOrder();
    eq('order header matches panel availability', $('#btnXml').disabled, $('#oZip').disabled);
    mpcApi = async () => ({languages:[]}); mpcSearch = async () => new Map();
    await openMpcPicker({e:{name:'Keyboard check', qty:1, faces:[{name:'Keyboard check'}]}});
    const figure = document.createElement('figure'); figure.tabIndex = 0;
    $('#mpcGrid').append(figure);
    let clicks = 0; figure.addEventListener('click', () => clicks++);
    for (const key of ['Enter', ' ']) {
      clicks = 0; figure.dispatchEvent(new KeyboardEvent('keydown', {key, bubbles:true, cancelable:true}));
      eq(`${key} selects art exactly once`, clicks, 1);
    }
  } finally {
    closeModal(true); mpcApi = originalApi; mpcSearch = originalSearch;sf=originalSf;
    S.mode = originalMode; applyMode(); switchTab('cards'); renderAll();
  }
  return fails.length ? {failed:fails} : true;
})();
