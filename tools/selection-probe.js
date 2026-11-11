// Copy selection and batch artwork regression checks for tools/console-check.js.
(async () => {
  const original = JSON.parse(JSON.stringify(S)), originalSelection = [...selectedCopies], originalDeck = selectionDeck, originalAnchor = selectionAnchor;
  const api = mpcApi, search = mpcSearch, cards = mpcCards, index = [...localIndex], created = new Set(), fails = [];
  const originalSf=sf;
  const eq = (name, got, want) => { if (JSON.stringify(got) !== JSON.stringify(want)) fails.push(`${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); };
  const waitFor = async fn => { for (let i = 0; i < 100; i++) { if (fn()) return; await sleep(30); } throw new Error('Timed out waiting for selection UI'); };
  try {
    closeModal(true);sf=async()=>({data:[],has_more:false});
    const c = document.createElement('canvas'); c.width = 63; c.height = 88;
    c.getContext('2d').fillRect(0, 0, 63, 88);
    const blob = await new Promise(r => c.toBlob(r)), key = await storeImage(blob); created.add(key);
    const entry = {uid:uid(), name:'Repeated card', qty:4, faces:[{name:'Front', custom:key}, {name:'Back', custom:key}]};
    const other = {uid:uid(), name:'Other card', qty:1, faces:[{name:'Other', custom:key}]};
    const d = {id:uid(), name:'Selection test', entries:[entry, other], updated:Date.now()};
    S.decks.push(d); S.deckId = d.id; S.mode = 'print'; S.showBacks = false; S.settings = {...DEFAULTS, dfcMode:'duplex'};
    applyMode(); renderAll(); await drawPreview();
    const copy = q => $(`#pages img[data-uid="${entry.uid}"][data-copy="${q}"]`);
    copy(0).click();
    copy(2).dispatchEvent(new MouseEvent('click', {bubbles:true, shiftKey:true}));
    eq('shift selects inclusive range', selectedCopies.size, 3);
    copy(1).dispatchEvent(new MouseEvent('click', {bubbles:true, ctrlKey:true}));
    eq('ctrl removes one copy', selectedCopies.size, 2);
    eq('partial row selection', $('#cardList [data-act="select"]').indeterminate, true);
    eq('selection actions visible', $('#cardSelection').hidden, false);
    const before = JSON.stringify(d.entries);
    mpcApi = async () => ({languages:[]}); mpcSearch = async () => new Map(); mpcCards = async () => [];
    localIndex.splice(0, localIndex.length, {file:new File([blob], 'Front.png', {type:'image/png'}), key:normName('Front'), words:new Set(['front'])});
    $('#changeSelectedArt').click();
    await waitFor(() => !!$('#mpcGrid figure[data-local]'));
    closeModal(true);
    eq('cancel leaves all copies intact', JSON.stringify(d.entries), before);
    $('#changeSelectedArt').click();
    await waitFor(() => !!$('#mpcGrid figure[data-local]'));
    $('#mpcGrid figure[data-local]').click();
    await waitFor(() => selectedCopies.size === 0);
    const slots = buildSlots();
    slots.forEach(s => created.add(s.front.custom));
    eq('partial edit preserves card count', slots.length, 5);
    eq('only chosen copy positions change', slots.map(s => s.front.custom === key), [false, true, false, true, true]);
    eq('other face stays intact', slots.slice(0, 4).every(s => s.back.custom === key), true);
    eq('all entries retain distinct ids', new Set(d.entries.map(e => e.uid)).size, d.entries.length);
    eq('split quantities survive saved-data validation', cleanDeck(d).entries.reduce((n, e) => n + e.qty, 0), 5);
    const first = d.entries[0]; selectCopy(first, 0);
    $('#selectAllCopies').click();
    eq('select all copies includes separate art entries', selectedCopies.size, 4);
    eq('select all excludes other cards', selectedCopies.has(copyKey(other, 0)), false);
    const target = selectedArtTarget();
    await applyArtChoice(target, 1, async f => { f.custom = key; f.localName = 'Changed back'; });
    eq('batch back choice applies to every selected copy', buildSlots().slice(0, 4).every(s => s.back.localName === 'Changed back'), true);
    eq('batch back choice preserves front variants', buildSlots().map(s => s.front.custom === key), [false, true, false, true, true]);
    S.mode = 'order'; applyMode(); renderAll(); await drawPreview();
    eq('order gallery shows each copy', $$('#pages .tile').length, 5);
    const gallery = $$('#pages img[data-copy][data-face="0"]');
    gallery[0].click(); gallery[2].dispatchEvent(new MouseEvent('click', {bubbles:true, shiftKey:true}));
    eq('order gallery supports range selection', selectedCopies.size, 3);
    S.deckId = original.deckId; renderAll();
    eq('switching decks clears selection', selectedCopies.size, 0);
  } catch (err) { fails.push(`${err.message}\n${err.stack}`); }
  finally {
    closeModal(true);sf=originalSf; mpcApi = api; mpcSearch = search; mpcCards = cards; localIndex.splice(0, localIndex.length, ...index);
    Object.assign(S, original); selectedCopies = new Set(originalSelection); selectionDeck = originalDeck; selectionAnchor = originalAnchor;
    for (const key of created) await removeImageIfUnused(key);
    save(); applyMode(); renderAll();
  }
  return fails.length ? {failed:fails} : true;
})();
