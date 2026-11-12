// Test changing orientation via #tab-setup dropdown directly
(() => {
  const failed = [];
  const eq = (name, got, want) => {
    if (got !== want) failed.push(`${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
  };

  const originalS = JSON.parse(JSON.stringify(S));

  try {
    for (const printer of ['et2800', 'mf753']) {
      S.printer = printer;
      for (const paper of ['letter', 'a4']) {
        // 1. Cameo
        S.settings = {...DEFAULTS, pageSize: paper};
        renderAll();
        $('#btnCutModeCameo').click();
        $(`#presetGrid [data-preset="${paper === 'a4' ? 'b-a4-land' : 'b-letter-land'}"]`).click();
        eq(`${printer} ${paper} cameo initially landscape`, S.settings.orientation, 'landscape');
        eq(`${printer} ${paper} cameo initial cards`, layout().per, 8);

        // Change orientation dropdown to portrait
        const optOr = document.querySelector('#tab-setup [data-k="orientation"]');
        if (!optOr) { failed.push('No orientation select in #tab-setup'); continue; }
        optOr.value = 'portrait';
        optOr.dispatchEvent(new Event('change', {bubbles: true}));

        eq(`${printer} ${paper} cameo orientation changed`, S.settings.orientation, 'portrait');
        eq(`${printer} ${paper} cameo portrait 9 cards`, layout().per, 9);
        eq(`${printer} ${paper} cameo portrait regConflict false`, regConflict(layout()), false);
        eq(`${printer} ${paper} cameo status ready`, $('#cameoStatus')?.textContent.includes('Layout ready for the Cameo'), true);

        // 2. Rotary
        $('#btnCutModeRotary').click();
        $(`#presetGrid [data-preset="${paper === 'a4' ? 'b-a4-land' : 'b-letter-land'}"]`).click();
        eq(`${printer} ${paper} rotary initially landscape`, S.settings.orientation, 'landscape');

        // Change orientation dropdown to portrait
        const optOrRot = document.querySelector('#tab-setup [data-k="orientation"]');
        optOrRot.value = 'portrait';
        optOrRot.dispatchEvent(new Event('change', {bubbles: true}));

        eq(`${printer} ${paper} rotary orientation changed`, S.settings.orientation, 'portrait');
        eq(`${printer} ${paper} rotary portrait 9 cards`, layout().per, 9);
        eq(`${printer} ${paper} rotary status ready`, $('#cutStatus')?.textContent.includes('Layout ready for the trimmer'), true);
      }
    }
  } catch (err) {
    failed.push('Exception: ' + (err.stack || err.message));
  } finally {
    Object.assign(S, originalS);
    renderAll();
  }

  return failed.length ? {failed} : true;
})();
