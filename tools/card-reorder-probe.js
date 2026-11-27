// Regression probe for rearranging card order (card list drag/drop, keyboard, context menu, sheet preview drag/drop).
(async () => {
  const fails = [];
  const check = (name, ok, detail = '') => { if (!ok) fails.push(detail ? `${name}: ${detail}` : name); };
  const origDecks = structuredClone(S.decks);
  const origDeckId = S.deckId;
  const origMode = S.mode;
  const origShowBacks = S.showBacks;
  const mkSwatch = color => {
    const c = document.createElement('canvas'); c.width = 60; c.height = 84;
    const g = c.getContext('2d'); g.fillStyle = color; g.fillRect(0, 0, 60, 84);
    return c.toDataURL('image/png');
  };
  const names = () => deck().entries.map(e => e.name);
  const slotNames = () => buildSlots().map(s => s.e.name);
  try {
    const d = deck();
    d.entries = [
      {uid: 'u1', qty: 1, name: 'Alpha Card', kind: 'CARD', set: 'tst', cn: '1', faces: [{name: 'Alpha Card', png: mkSwatch('#c0392b')}]},
      {uid: 'u2', qty: 1, name: 'Beta Card', kind: 'CARD', set: 'tst', cn: '2', faces: [{name: 'Beta Card', png: mkSwatch('#2980b9')}]},
      {uid: 'u3', qty: 1, name: 'Gamma Card', kind: 'CARD', set: 'tst', cn: '3', faces: [{name: 'Gamma Card', png: mkSwatch('#27ae60')}]},
      {uid: 'u4', qty: 2, name: 'Delta Card', kind: 'CARD', set: 'tst', cn: '4', faces: [{name: 'Delta Card', png: mkSwatch('#8e44ad')}]},
    ];
    S.mode = 'print';
    S.showBacks = false;
    renderAll();
    await sleep(40);

    // 1. Drag handle and draggable attributes present when >1 card.
    const rows = $$('#cardList .card');
    check('renders 4 draggable card rows', rows.length === 4 && rows.every(r => r.draggable === true));
    check('each row has enabled drag handle', rows.every(r => !r.querySelector('[data-act="drag"]').disabled));

    // 2. Keyboard reordering on drag handle (ArrowDown, ArrowUp, End, Home) + focus preservation.
    const h1 = $('#cardList [data-uid="u1"] [data-act="drag"]');
    h1.focus();
    h1.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowDown', bubbles: true, cancelable: true}));
    check('ArrowDown moves first card down', names().join(',') === 'Beta Card,Alpha Card,Gamma Card,Delta Card', names().join(','));
    check('ArrowDown keeps focus on moved card handle', document.activeElement === $('#cardList [data-uid="u1"] [data-act="drag"]'));

    document.activeElement.dispatchEvent(new KeyboardEvent('keydown', {key: 'End', bubbles: true, cancelable: true}));
    check('End moves card to bottom', names().join(',') === 'Beta Card,Gamma Card,Delta Card,Alpha Card', names().join(','));

    document.activeElement.dispatchEvent(new KeyboardEvent('keydown', {key: 'Home', bubbles: true, cancelable: true}));
    check('Home moves card to top', names().join(',') === 'Alpha Card,Beta Card,Gamma Card,Delta Card', names().join(','));

    // 3. Context menu Move up / Move down (and boundary omission).
    openCtx(100, 100, d.entries[0], 0);
    check('first card ctx omits Move up and shows Move down', !$('#ctx [data-c="moveup"]') && !!$('#ctx [data-c="movedown"]'));
    $('#ctx [data-c="movedown"]').click();
    check('ctx Move down reorders entries and slots', names().join(',') === 'Beta Card,Alpha Card,Gamma Card,Delta Card' && slotNames()[0] === 'Beta Card', names().join(','));

    openCtx(100, 100, d.entries[3], 0);
    check('last card ctx shows Move up and omits Move down', !!$('#ctx [data-c="moveup"]') && !$('#ctx [data-c="movedown"]'));
    $('#ctx [data-c="moveup"]').click();
    check('ctx Move up moves last card up', names().join(',') === 'Beta Card,Alpha Card,Delta Card,Gamma Card', names().join(','));

    // 4. Drag-and-drop in #cardList (drop Gamma before Beta).
    const mkDT = () => {
      const store = new Map();
      return {
        effectAllowed: '', dropEffect: '',
        get types() { return [...store.keys()]; },
        setData(k, v) { store.set(k, v); },
        getData(k) { return store.get(k) || ''; }
      };
    };
    const dt1 = mkDT();
    const srcRow = $('#cardList [data-uid="u3"]');
    const dstRow = $('#cardList [data-uid="u2"]');
    const dstRect = dstRow.getBoundingClientRect();
    srcRow.dispatchEvent(Object.assign(new Event('dragstart', {bubbles: true, cancelable: true}), {dataTransfer: dt1}));
    dstRow.dispatchEvent(Object.assign(new Event('dragover', {bubbles: true, cancelable: true}), {dataTransfer: dt1, clientY: dstRect.top + 2}));
    check('cardList dragover top half marks drop-before', dstRow.classList.contains('drop-before'));
    check('internal card drag does not open global file drop overlay', !$('#drop').classList.contains('on'));
    dstRow.dispatchEvent(Object.assign(new Event('drop', {bubbles: true, cancelable: true}), {dataTransfer: dt1, clientY: dstRect.top + 2}));
    srcRow.dispatchEvent(Object.assign(new Event('dragend', {bubbles: true}), {dataTransfer: dt1}));
    check('cardList drop moves Gamma before Beta', names().join(',') === 'Gamma Card,Beta Card,Alpha Card,Delta Card', names().join(','));

    // 5. Drag-and-drop directly on #pages print sheet preview (drop Gamma after Delta).
    await drawPreview();
    const pgSrc = $('#pages img[data-uid="u3"]');
    const pgDst = $('#pages img[data-uid="u4"]');
    check('sheet preview front images are draggable', pgSrc?.draggable === true && pgDst?.draggable === true);
    const dt2 = mkDT();
    const pgRect = pgDst.getBoundingClientRect();
    pgSrc.dispatchEvent(Object.assign(new Event('dragstart', {bubbles: true, cancelable: true}), {dataTransfer: dt2}));
    pgDst.dispatchEvent(Object.assign(new Event('dragover', {bubbles: true, cancelable: true}), {dataTransfer: dt2, clientX: pgRect.right - 2}));
    check('sheet preview dragover right half marks drop-after', pgDst.classList.contains('drop-after'));
    pgDst.dispatchEvent(Object.assign(new Event('drop', {bubbles: true, cancelable: true}), {dataTransfer: dt2, clientX: pgRect.right - 2}));
    pgSrc.dispatchEvent(Object.assign(new Event('dragend', {bubbles: true}), {dataTransfer: dt2}));
    check('sheet preview drop moves Gamma after Delta', names().join(',') === 'Beta Card,Alpha Card,Delta Card,Gamma Card', names().join(','));

    // 6. Filtered list stepping moves past visible neighbor.
    $('#deckFilter').value = 'a'; // matches all 4; narrow to 'ta' -> Beta Card, Delta Card
    $('#deckFilter').value = 'ta';
    $('#deckFilter').dispatchEvent(new Event('input', {bubbles: true}));
    const betaHandle = $('#cardList [data-uid="u2"] [data-act="drag"]');
    betaHandle.focus();
    betaHandle.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowDown', bubbles: true, cancelable: true}));
    check('filtered ArrowDown moves Beta past visible Delta', names().indexOf('Beta Card') > names().indexOf('Delta Card'), names().join(','));
    $('#deckFilter').value = '';
    $('#deckFilter').dispatchEvent(new Event('input', {bubbles: true}));

    // 7. Single-card deck disables drag handle and draggable.
    d.entries = [d.entries[0]];
    renderAll();
    const soleRow = $('#cardList .card');
    check('single-card deck disables drag handle and draggable', soleRow.draggable === false && soleRow.querySelector('[data-act="drag"]').disabled === true);
  } catch (err) {
    fails.push('threw: ' + (err.stack || err));
  } finally {
    S.decks = origDecks;
    S.deckId = origDeckId;
    S.mode = origMode;
    S.showBacks = origShowBacks;
    renderAll();
  }
  return fails.length ? {fails} : true;
})();
