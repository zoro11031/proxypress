// Settings, disclosure, keyboard and feedback checks for tools/console-check.js.
(async () => {
  const original = JSON.parse(JSON.stringify(S)), confirm = window.confirm, fails = [];
  const eq = (name, got, want) => { if (JSON.stringify(got) !== JSON.stringify(want)) fails.push(`${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); };
  let key;
  try {
    closeModal(true);
    const canvas = document.createElement('canvas'); canvas.width = 63; canvas.height = 88;
    key = await storeImage(await new Promise(r => canvas.toBlob(r)));
    const d = {id:uid(), name:'UX probe', entries:[{uid:uid(), name:'Test card', qty:4, faces:[{name:'Test card', custom:key}], tokens:[]}], updated:Date.now()};
    S.decks.push(d); S.deckId = d.id; S.settings = {...DEFAULTS, backImage:key, offsetX:7, scaleX:98}; S.printer = 'mf753';
    S.mpc = {...MPC_DEFAULTS, minDpi:600}; S.showCuts = true; S.showBacks = false;
    S.presets.push({id:uid(), name:'My settings', settings:{...S.settings}});
    const presets = JSON.stringify(S.presets), decks = JSON.stringify(S.decks);
    applyMode(); renderAll();
    $('#btnSettings').focus(); $('#btnSettings').click();
    eq('defaults available under gear', !!$('#dataSlot #resetSettings'), true);
    eq('dialog has accessible title', $('#modal').getAttribute('aria-labelledby'), 'modalTitle');
    const items = modalFocusable(); items[0].focus();
    items[0].dispatchEvent(new KeyboardEvent('keydown', {key:'Tab', shiftKey:true, bubbles:true, cancelable:true}));
    eq('shift-tab stays in dialog', document.activeElement === items.at(-1), true);
    items.at(-1).dispatchEvent(new KeyboardEvent('keydown', {key:'Tab', bubbles:true, cancelable:true}));
    eq('tab wraps inside dialog', document.activeElement === items[0], true);
    window.confirm = () => false; $('#resetSettings').click();
    eq('cancel keeps calibration', S.settings.offsetX, 7);
    window.confirm = () => true; $('#resetSettings').click();
    eq('defaults reset calibration', S.settings.offsetX, 0);
    eq('defaults reset printer', S.printer, 'et2800');
    eq('defaults reset art search', S.mpc, MPC_DEFAULTS);
    eq('defaults keep decks', JSON.stringify(S.decks), decks);
    eq('defaults keep saved presets', JSON.stringify(S.presets), presets);
    eq('defaults keep uploaded cardback', S.settings.backImage, key);
    eq('defaults keep image data', !!(await store.get('images', key)), true);
    eq('defaults reset preview', [S.showCuts, S.showBacks], [false, true]);
    closeModal(true);
    eq('dialog restores opener focus', document.activeElement === $('#btnSettings'), true);
    S.settings = {...DEFAULTS}; renderSettings();
    eq('single-faced deck hides duplex method', !!$('#setting-duplexMethod'), false);
    d.entries[0].faces.push({name:'Back', custom:key}); renderSettings();
    eq('double-faced deck offers duplex method', !!$('#setting-duplexMethod'), true);
    S.settings.dfcMode = 'front'; renderSettings();
    eq('front-only choice hides duplex method', !!$('#setting-duplexMethod'), false);
    S.settings.backs = true; renderSettings();
    eq('printed cardbacks offer duplex method', !!$('#setting-duplexMethod'), true);
    $('#deckFilter').hidden = false; $('#deckFilter').value = 'missing'; applyDeckFilter();
    eq('empty filter result explained', $('#deckFilterEmpty').hidden, false);
    $('#deckFilter').value = 'test'; applyDeckFilter();
    eq('matching filter clears message', $('#deckFilterEmpty').hidden, true);
    d.entries[0].faces[0].lowRes = true; renderCards();
    eq('missing-art count includes every copy', $('#deckHealth').textContent, '4 need art');
    const entries = d.entries; d.entries = []; renderGuideTab();
    eq('empty deck cannot download PDF', $('#btnExportPdfTab').disabled, true);
    d.entries = entries; renderGuideTab();
    eq('nonempty deck can download PDF', $('#btnExportPdfTab').disabled, false);
    d.entries[0].faces[0].lowRes = false;
    d.entries.push({uid:uid(), name:'Single faced', qty:2, faces:[{name:'Single faced', custom:key}]});
    d.cardback = {name:'Shared back', custom:key};
    S.mode = 'order'; S.orderShowBacks = false; S.showBacks = false;
    applyMode(); renderAll(); await drawPreview();
    eq('order preview shows all fronts', $$('#pages img[data-face="0"]').length, 6);
    eq('shared back appears once', $$('#pages .galnote img').length, 1);
    eq('order hides double-faced backs by default', $$('#pages img[data-face="1"]').length, 0);
    eq('order omits repeated shared backs', $$('#pages img[data-face="back"]').length, 0);
    $('#orderShowBacks').checked = true; $('#orderShowBacks').dispatchEvent(new Event('change')); await drawPreview();
    eq('order can reveal double-faced backs', $$('#pages img[data-face="1"]').length, 4);
    eq('order back toggle leaves print preview preference', S.showBacks, false);
    d.entries.pop(); await drawPreview();
    eq('double-faced-only deck needs no shared cardback preview', $$('#pages .galnote').length, 0);

  } catch (err) { fails.push(`${err.message}\n${err.stack}`); }
  finally {
    closeModal(true); window.confirm = confirm; Object.assign(S, original);
    $('#deckFilter').value = ''; if (key) await removeImageIfUnused(key);
    save(); applyMode(); renderAll();
  }
  return fails.length ? {failed:fails} : true;
})();
