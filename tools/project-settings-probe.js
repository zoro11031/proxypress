(async () => {
  const original=structuredClone(S);const fails=[];const check=(name,value)=>{if(!value)fails.push(name);};
  const flush=async()=>{await sleep(400);await saveQueue;};
  try {
    await flush();
    const legacySettings=cleanSettings({...DEFAULTS,pageSize:'letter',orientation:'landscape',brightness:107});
    const legacy=[{id:'legacy-a',name:'Legacy A',entries:[]},{id:'legacy-b',name:'Legacy B',entries:[]}];
    await store.commit([['decks',legacy],['ui',{deckId:'legacy-a',settings:legacySettings,mpc:MPC_DEFAULTS,welcomed:true}]]);
    await load();renderAll();
    check('legacy projects inherit their prior effective setup',S.decks.every(d=>d.printSettings.pageSize==='letter'&&d.printSettings.brightness===107));
    S.settings.pageSize='a4';S.settings.brightness=119;save();
    $('#deckSel').value='legacy-b';$('#deckSel').dispatchEvent(new Event('change'));
    check('switch restores other project setup',S.settings.pageSize==='letter'&&S.settings.brightness===107);
    S.settings.brightness=92;S.mpc.foil=true;save();await flush();
    $('#deckSel').value='legacy-a';$('#deckSel').dispatchEvent(new Event('change'));
    check('switch before debounce preserves outgoing setup',S.settings.pageSize==='a4'&&S.settings.brightness===119);
    save();await flush();await load();renderAll();
    check('reload preserves active project setup',S.settings.pageSize==='a4'&&S.settings.brightness===119);
    activateDeck('legacy-b');
    check('reload preserves inactive project setup and stock',S.settings.brightness===92&&S.mpc.foil);
    const c=document.createElement('canvas');c.width=63;c.height=88;
    const art=await storeImage(await new Promise(r=>c.toBlob(r)));
    deck().entries=[{uid:uid(),name:'Local',qty:1,faces:[{name:'Front',custom:art}]}];
    const other=S.decks.find(d=>d.id==='legacy-a');other.printSettings.backImage=art;
    await removeImageIfUnused(art);check('inactive project back art remains reachable',!!await store.get('images',art));
    const pack=await makePrintDeck();
    check('compact package has one layout source',!('printSettings' in pack.deck)&&!('orderSettings' in pack.deck)&&!!pack.settings);
    const cleaned=cleanDeck({...deck(),printSettings:{...S.settings,brightness:99999}});
    check('backup setup passes normal settings validation',cleaned.printSettings.brightness<=150);
    return fails.length?{failed:fails}:true;
  } finally {Object.assign(S,original);save();renderAll();}
})();
