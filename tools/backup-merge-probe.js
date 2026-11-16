(async () => {
  const fails=[];const check=(name,value)=>{if(!value)fails.push(name);};
  const original=structuredClone(S), confirmOriginal=window.confirm;
  try {
    S.welcomed=true;closeModal(true);
    const c=document.createElement('canvas');c.width=63;c.height=88;
    const blob=await new Promise(r=>c.toBlob(r)),key='colliding-backup-key';await store.set('images',key,blob);
    const data={app:'proxy-press',decks:[{id:deck().id,name:'Restored',entries:[{uid:uid(),qty:1,name:'Card',faces:[{name:'Front',custom:key,template:{artKey:key,style:'modern'}}]}],printSettings:{...DEFAULTS,backImage:key}}],settings:DEFAULTS,images:{[key]:c.toDataURL()}};
    const count=S.decks.length;window.confirm=()=>false;
    const f=new File([JSON.stringify(data)],'backup.json',{type:'application/json'});
    await $('#fileBackup').onchange({target:{files:[f],value:''}});
    check('restore merges without replacing existing deck',S.decks.length===count+1&&deck().id===original.deckId);
    const restored=S.decks.at(-1),newKey=restored.entries[0].faces[0].custom;
    check('colliding artwork gets a fresh ID',newKey!==key&&!!await store.get('images',newKey));
    check('existing artwork is unchanged',(await store.get('images',key)).size===blob.size);
    check('sources and project backs remap together',restored.entries[0].faces[0].template.artKey===newKey&&restored.printSettings.backImage===newKey);
    const font=await blobToData(new Blob(['font bytes'],{type:'font/ttf'}));
    const assets=await prepareBackupRestore({...data,presets:[{id:'back-preset',settings:{...DEFAULTS,backImage:key}}],ccFonts:{name:'font-key'},ccFontNames:{name:'Fixture font'},frameSets:[{id:'frame-fixture',images:{wcard:key}}],images:{...data.images,'font-key':font}});
    check('font bytes and names survive a full backup',!!assets.ccFonts.name&&assets.ccFontNames.name==='Fixture font'&&(await store.get('images',assets.ccFonts.name)).type==='font/ttf');
    check('preset backs and frame images remap',assets.presets[0].settings.backImage===assets.decks[0].printSettings.backImage&&assets.frameSets[0].images.wcard===assets.decks[0].printSettings.backImage);
    check('font serialization is supported',(await (await imageJsonBlob('font',new Blob(['font'],{type:'font/ttf'}),true)).text()).includes('data:font/ttf;base64,'));
    let rejected=false;try{await prepareBackupRestore({...data,images:{}});}catch{rejected=true;}
    check('missing attachments reject before adding decks',rejected&&S.decks.length===count+1);
    return fails.length?{failed:fails}:true;
  } finally {window.confirm=confirmOriginal;Object.assign(S,original);save();renderAll();}
})();
