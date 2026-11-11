// Browser regression checks for order exports, custom cards and shared print decks.
(async () => {
  const fails = [], original = JSON.parse(JSON.stringify(S)), created = [], downloads = [], shares = [];
  const eq = (name, got, want) => { if (got !== want) fails.push(`${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); };
  const waitFor = async fn => { for (let i = 0; i < 100; i++) { if (fn()) return; await sleep(50); } throw new Error('Timed out waiting for UI'); };
  const originalDownload = download, originalFetch = window.fetch, originalSf = sf, originalConfirm = window.confirm;
  const originalImportList = importList;
  const originalInfo = mpcCardInfo, originalApi = mpcApi, originalSearch = mpcSearch, originalCards = mpcCards, originalLocal = [...localIndex];
  download = (blob, name) => downloads.push({blob, name});
  try {
    closeModal(true);
    const canvas = document.createElement('canvas'); canvas.width = 180; canvas.height = 250;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#d87338'; ctx.fillRect(0, 0, 90, 250); ctx.fillStyle = '#376a9c'; ctx.fillRect(90, 0, 90, 250);
    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
    const image = await storeImage(blob); created.push(image);
    const d = {id:uid(), name:'Shared ☃ \"deck\" & art', entries:[], updated:Date.now(), cardback:{name:'Back', custom:image, srcBleed:3.048}};
    S.decks.push(d); S.deckId = d.id; S.settings = {...DEFAULTS, pageSize:'a4', backs:true, backImage:null, offsetX:3, scaleX:99};
    S.mode = 'order'; applyMode(); renderAll();
    eq('empty order export disabled', $('#oZip').disabled, true);
    $('#btnXml').click(); eq('header opens review', $('#tab-order').classList.contains('on'), true);
    d.entries = [{uid:uid(), name:'Custom front', qty:2, custom:true, faces:[{name:'Custom front', custom:image, srcBleed:3.048}], tokens:[]},
      {uid:uid(), name:'Double faced', qty:1, custom:true, faces:[{name:'Front', custom:image}, {name:'Back', custom:image}], tokens:[]}];
    renderAll();
    eq('all local art ready', buildMpcOrder(true).slot, 3);
    eq('XML omits uploads', buildMpcOrder(false).uploads.length, 3);
    eq('XML disabled for all local images', $('#oXml').disabled, true);
    eq('XML summary counts excluded copies', $('#xmlSummary').textContent, '0 cards included · 3 left out. Your uploaded cardback is also left out.');
    mpcCardInfo = async () => f => ({file:f.file, query:f.name});
    await exportMpcZip();
    eq('ZIP downloaded', downloads.at(-1)?.name.endsWith('.zip'), true);
    const zip = new Uint8Array(await downloads.at(-1).blob.arrayBuffer()), view = new DataView(zip.buffer), enc = new TextDecoder(), files = new Map();
    for (let pos = 0; view.getUint32(pos, true) === 0x04034b50;) {
      const length = view.getUint32(pos + 18, true), nameLength = view.getUint16(pos + 26, true), extra = view.getUint16(pos + 28, true);
      const name = enc.decode(zip.slice(pos + 30, pos + 30 + nameLength)), start = pos + 30 + nameLength + extra;
      files.set(name, zip.slice(start, start + length)); pos = start + length;
    }
    const xml = new DOMParser().parseFromString(enc.decode([...files].find(([name]) => name.endsWith('.xml'))[1]), 'application/xml');
    eq('XML quantity', xml.querySelector('quantity').textContent, '3');
    eq('ZIP deduplicates artwork', [...files.keys()].filter(n => n.startsWith('cards/')).length, 1);
    for (const id of [...xml.querySelectorAll('card > id, cardback')].map(el => el.textContent)) eq('every local XML path exists in ZIP', files.has(id), true);
    d.entries.push({uid:uid(), name:'Missing back', qty:1, faces:[{name:'Front', custom:image}, {name:'Missing'}], tokens:[]});
    renderAll(); eq('ordinary missing art offers auto fill', $('#oAuto').textContent, 'Auto fill art');
    d.entries.at(-1).mpc = true; renderAll(); eq('imported missing art offers image attachment', $('#oAuto').textContent, 'Attach images…');
    d.entries.at(-1).mpc = false;
    const before = downloads.length;
    await exportMpcZip();
    eq('partial export requires review', !!$('#orderReviewExport'), true);
    eq('partial export does not download yet', downloads.length, before);
    closeModal(true); d.entries.pop();
    // Failed remote responses must never be packed into an order as images.
    d.entries = [{uid:uid(), name:'Remote', qty:1, faces:[{name:'Remote', drive:'test-drive-id', file:'Remote.png'}], tokens:[]}];
    window.fetch = async () => new Response('upstream error', {status:503});
    await exportMpcZip(true);
    eq('HTTP error prevents download', downloads.length, before);
    eq('HTTP error explained', $('#toast').textContent.includes('HTTP 503'), true);
    let remoteFetches = 0;
    window.fetch = async () => { remoteFetches++; return new Response(blob, {headers:{'Content-Type':'image/png'}}); };
    const embedded = await makePrintDeck();
    eq('shared remote art embedded', typeof embedded.images[embedded.deck.entries[0].faces[0].custom], 'string');
    eq('remote art fetched once', remoteFetches, 1);
    d.entries = [{uid:uid(), name:'Placeholder', qty:1, faces:[{name:'Placeholder', png:'https://cards.scryfall.io/png/front/test.png'}], tokens:[]}];
    const previewPackage = await makePrintDeck();
    eq('shared placeholders remain marked low resolution', isPreview(previewPackage.deck.entries[0].faces[0]), true);
    window.fetch = originalFetch;
    // Exercise the real editor, PNG rendering, persistence, and thumbnail edit path.
    d.entries = []; renderAll();
    await openCardMaker({});
    eq('new card cannot save without art', $('#ccSave').disabled, true);
    const dt = new DataTransfer(); dt.items.add(new File([blob], 'art.png', {type:'image/png'}));
    $('#ccFile').files = dt.files; await $('#ccFile').onchange({target:$('#ccFile')});
    eq('valid art enables save', $('#ccSave').disabled, false);
    $('#cc-name').value = 'Test <card> & name'; $('#cc-name').dispatchEvent(new Event('input', {bubbles:true}));
    $('#cc-text').value = 'A long rule. '.repeat(70); $('#cc-text').dispatchEvent(new Event('input', {bubbles:true}));
    $('#cc-skin').value = 'Nickname'; $('#cc-skin').dispatchEvent(new Event('input', {bubbles:true}));
    $('[data-cc="selfRef"]').value = 'dual'; $('[data-cc="selfRef"]').dispatchEvent(new Event('input', {bubbles:true}));
    $('#ccZoom').value = '2'; $('#ccZoom').dispatchEvent(new Event('input', {bubbles:true}));
    $('#ccArtReset').click(); eq('reset zoom', $('#ccZoom').value, '1');
    const beforeMatchSf=sf;sf=async()=>({data:[],has_more:false});
    await $('#ccSave').onclick();sf=beforeMatchSf;
    eq('new custom card offers optional matching',!!$('#matchSkip'),true);$('#matchSkip').click();
    eq('custom card created', d.entries.length, 1);
    const f = d.entries[0].faces[0]; created.push(f.custom, f.template.artKey);
    const rendered = await loadImage(await customUrl(f.custom));
    eq('saved card is print resolution', rendered.naturalWidth > 1600 && rendered.naturalHeight > 2200, true);
    const cleaned = cleanDeck(d).entries[0].faces[0];
    eq('backup retains nickname', cleaned.template.skin, 'Nickname');
    eq('backup retains self-reference setting', cleaned.template.selfRef, 'dual');
    eq('backup retains long rules', cleaned.template.text, f.template.text);
    const options = cleanDeck({entries:[{faces:[{template:{stamp:'ub', popKey:image, artMode:'textless', cset:'tst', cnum:'42', rarity:'rare'}}]}]}).entries[0].faces[0].template;
    eq('backup retains pop-out layer', options.popKey, image); eq('backup retains textless', options.artMode, 'textless'); eq('backup retains stamp', options.stamp, 'ub');
    $('#cardList img[data-act="art"]').click();
    await waitFor(() => $('#overlay').classList.contains('on') && !!$('#cc-name'));
    eq('thumbnail reopens custom editor', $('#cc-name').value, 'Test <card> & name');
    eq('reopened nickname retained', $('#cc-skin').value, 'Nickname');
    let asked = 0; window.confirm = () => { asked++; return false; };
    $('#cc-name').value = 'Unsaved'; $('#cc-name').dispatchEvent(new Event('input', {bubbles:true}));
    closeModal(); eq('unsaved changes can keep editor open', $('#overlay').classList.contains('on'), true); eq('discard guard fired', asked, 1);
    window.confirm = originalConfirm;
    // Loading either face of a real card should preserve the chosen art.
    sf = async () => ({name:'Front // Back', data:[], card_faces:[{name:'Front', type_line:'Creature', oracle_text:'Front rules', image_uris:{}}, {name:'Back', type_line:'Creature', oracle_text:'Back rules', image_uris:{}}]});
    $('#ccLookup').value = 'Double face'; await $('#ccFill').onclick();
    $('#ccFace').value = '1'; $('#ccFace').dispatchEvent(new Event('change'));
    eq('lookup can select back face', $('#cc-name').value, 'Back');
    eq('lookup keeps uploaded art', $('#ccSave').disabled, false);
    closeModal(true); sf = originalSf;
    // Compact print decks restore originals when the server is available.
    S.mode='print';applyMode();switchTab('guide');
    $('#printDeckOut').closest('details').open=true;
    eq('share is a visible print export option',$('#printDeckOut').getClientRects().length>0,true);
    await $('#printDeckOut').onclick();
    const sharedDownload = downloads.at(-1);
    eq('share export downloads JSON', sharedDownload.name.endsWith('(print deck).json'), true);
    const parsed = await readPrintDeck(sharedDownload.blob); if(parsed.originalShare)shares.push(parsed.originalShare.token);
    S.mode='order';applyMode();switchTab('order');
    $('#orderPrintDeckOut').closest('details').open=true;
    eq('share is a visible order export option',$('#orderPrintDeckOut').getClientRects().length>0,true);
    await $('#orderPrintDeckOut').onclick();
    const orderShare=await readPrintDeck(downloads.at(-1).blob);if(orderShare.originalShare)shares.push(orderShare.originalShare.token);
    eq('order-mode share includes the same artwork',orderShare.images[f.custom],parsed.images[f.custom]);
    const tricky = {images:{'img-test':'data:image/png;base64,abc='}, deck:{name:'Unicode ☃ \"quoted\" \\ slash', entries:[{text:'braces { } [ ] and \\ escape'}]}, version:1, bool:true, empty:null};
    const bytes = new TextEncoder().encode(JSON.stringify(tricky, null, 2));
    const chunked = {stream:() => new ReadableStream({start(controller) { for (let i = 0; i < bytes.length; i += 3) controller.enqueue(bytes.slice(i, i + 3)); controller.close(); }})};
    eq('streamed JSON handles split Unicode, escapes and objects', JSON.stringify(await readPrintDeck(chunked)), JSON.stringify(tricky));
    try { await readPrintDeck(new Blob(['{} trailing'])); fails.push('trailing JSON data accepted'); } catch {}
    eq('configured share limit is 2 GB', PRINT_DECK_LIMIT, 2 * 1024 * 1024 * 1024);
    await openPrintDeckFile({size:PRINT_DECK_LIMIT + 1, text:() => { throw new Error('Oversized file was read'); }});
    eq('oversized file rejected before reading', $('#toast').textContent.includes('2 GB'), true);
    eq('shared format version', parsed.version, 1);
    eq('shared data includes rendered art', typeof parsed.images[f.custom], 'string');
    eq('shared data includes editable source art', typeof parsed.images[f.template.artKey], 'string');
    eq('shared layout excludes sender calibration', parsed.settings.offsetX, undefined);
    const oldCount = S.decks.length; S.settings.offsetX = -2; S.settings.scaleX = 101; S.printer = 'mf753';
    const recipient = await importPrintDeck(parsed);
    created.push(...printDeckKeys(recipient, S.settings));
    eq('import creates a new deck', S.decks.length, oldCount + 1);
    eq('original deck remains', S.decks.includes(d), true);
    eq('import remaps rendered image key', recipient.entries[0].faces[0].custom !== f.custom, true);
    eq('imported art restores original bytes', await blobToData(await store.get('images', recipient.entries[0].faces[0].custom)) === await blobToData(await store.get('images', f.custom)), true);
    eq('shared A4 layout restored', S.settings.pageSize, 'a4');
    eq('recipient offset preserved', S.settings.offsetX, -2); eq('recipient scale preserved', S.settings.scaleX, 101); eq('recipient printer preserved', S.printer, 'mf753');
    eq('import opens print setup', $('#tab-setup').classList.contains('on'), true); eq('import selects print mode', S.mode, 'print');
    await renderFace(recipient.entries[0].faces[0], 150, true);
    const bad = JSON.parse(JSON.stringify(parsed)); delete bad.images[f.custom];
    const count = S.decks.length;
    try { await importPrintDeck(bad); fails.push('incomplete share accepted'); } catch {}
    eq('incomplete import leaves decks intact', S.decks.length, count);
    S.settings.pageSize = 'letter'; await importPrintDeck(parsed, false);
    created.push(...printDeckKeys(deck(), S.settings)); eq('optional import keeps recipient layout', S.settings.pageSize, 'letter');
    // The import picker accepts remote links and local shared decks, backups and text.
    const importedLists = [];
    importList = async text => importedLists.push(text);
    for (const host of ['moxfield', 'archidekt']) {
      $('#btnLink').click();
      eq('import picker offers local files', !!$('#importLocal'), true);
      $('#linkIn').value = `${host}.com/decks/example`;
      $('#importLinkSubmit').click();
      eq(`${host} link normalized`, importedLists.at(-1), `https://${host}.com/decks/example`);
    }
    await importDeckFile(new File(['2 Sol Ring'], 'deck.txt', {type:'text/plain'}));
    eq('local text uses decklist importer', importedLists.at(-1), '2 Sol Ring');
    importList = originalImportList;
    await importDeckFile(new File([JSON.stringify(parsed)], 'shared.json', {type:'application/json'}));
    eq('local shared deck opens review', !!$('#printDeckConfirm'), true); closeModal(true);
    const backupCount = S.decks.length, backupPaper = S.settings.pageSize;
    const backup = {app:'proxy-press', version:1, decks:[parsed.deck], settings:parsed.settings, images:parsed.images};
    await importDeckFile(new File([JSON.stringify(backup)], 'backup.json', {type:'application/json'}));
    eq('local backup offers deck selection', $('#backupDeckChoice')?.options.length, 1);
    await $('#backupDeckImport').onclick();
    created.push(...printDeckKeys(deck(), S.settings));
    eq('backup picker adds selected deck', S.decks.length, backupCount + 1);
    eq('backup picker keeps paper settings', S.settings.pageSize, backupPaper);
    eq('backup picker keeps printer alignment', S.settings.offsetX, -2);
    // Late art-search responses must not write into a closed or replacement modal.
    let resolveSearch;
    mpcApi = async () => ({languages:[]}); mpcCards = async () => [];
    mpcSearch = () => new Promise(r => { resolveSearch = r; });
    const pickedFace = {name:'Slow search'}, localFile = new File([blob], 'Slow search.png', {type:'image/png'});
    localIndex.push({file:localFile, key:normName('Slow search'), words:new Set(['slow','search'])});
    await openMpcPicker({e:{name:'Slow search', faces:[pickedFace]}});
    const figure = $('#mpcGrid figure[data-local]');
    eq('art choice is keyboard accessible', figure?.getAttribute('role'), 'button');
    figure.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true}));
    await waitFor(() => !!pickedFace.custom); created.push(pickedFace.custom);
    eq('keyboard selects uploaded art', !!pickedFace.custom, true);
    closeModal(true); openModal('<div class="hd"><b>Another dialog</b></div><div class="bd">Keep this content</div>');
    resolveSearch(new Map([['slow search|CARD', []]])); await sleep(150);
    eq('late search leaves next dialog intact', $('#modal .bd').textContent, 'Keep this content');
  } catch (err) { fails.push(`${err.message}\n${err.stack}`); }
  finally {
    closeModal(true); importList = originalImportList; download = originalDownload; window.fetch = originalFetch; sf = originalSf;
    for(const id of shares){try{await shareRequest('/shares/'+id+'/delete',{});}catch{}}
    localIndex.splice(0, localIndex.length, ...originalLocal);
    mpcCardInfo = originalInfo; mpcApi = originalApi; mpcSearch = originalSearch; mpcCards = originalCards;
    window.confirm = originalConfirm; Object.assign(S, original); for (const key of new Set(created)) await removeImageIfUnused(key);
    save(); applyMode(); renderAll();
  }
  return fails.length ? {failed:fails} : true;
})();
