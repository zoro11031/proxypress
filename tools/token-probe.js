// Token names can match the back of a Scryfall double-faced printing.
(async()=>{
  const original=JSON.parse(JSON.stringify(S)), oldSf=sf, oldAuto=mpcAutofill, oldRecommendations=cardRecommendations, oldFetch=window.fetch, oldDoc=newDoc;
  const oldBase=mpcBase, oldSearch=mpcSearch, oldCards=mpcCards, oldThumb=thumbSrc, oldPreview=previewUrl;
  const failed=[], images=new Set(), eq=(label,got,want)=>{if(got!==want)failed.push(`${label}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);};
  const wait=async fn=>{for(let i=0;i<150;i++){if(fn())return;await sleep(20);}throw Error('Timed out waiting for token UI');};
  const remember=()=>{for(const e of deck().entries)for(const f of e.faces)if(f.custom)images.add(f.custom);};
  try {
    closeModal(true);cardRecommendations=async()=>[];
    const canvas=document.createElement('canvas');canvas.width=126;canvas.height=176;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#357a45';ctx.fillRect(0,0,126,176);const dinosaur=canvas.toDataURL();
    ctx.fillStyle='#d4a13a';ctx.fillRect(0,0,126,176);const treasure=canvas.toDataURL();
    const pair={id:'21f5880d-6272-4ba8-bdf8-f9a7e54a3336',name:'Dinosaur // Treasure',layout:'double_faced_token',type_line:'Token Creature — Dinosaur // Token Artifact — Treasure',set:'f17',set_name:'Friday Night Magic 2017',collector_number:'11',color_identity:['G'],lang:'en',card_faces:[
      {name:'Dinosaur',type_line:'Token Creature — Dinosaur',colors:['G'],image_uris:{png:dinosaur,normal:dinosaur}},
      {name:'Treasure',type_line:'Token Artifact — Treasure',colors:[],image_uris:{png:treasure,normal:treasure}}
    ]};
    const single=toEntry(pair,2,'Treasure');
    eq('named Treasure uses one face',single.faces.length,1);eq('named Treasure is not Dinosaur',single.faces[0].name,'Treasure');eq('Treasure keeps the source face index',single.scryFace,1);
    sf=async()=>({data:[pair]});
    const collection=await fetchCollection([{id:{name:'Treasure'}},{id:{name:'Dinosaur'}}]);eq('one printing can satisfy two face names',collection.found.length,2);eq('neither face is missing',collection.missing.length,0);
    if(typeof cacheTokenPrinting!=='function')return {failed:[...failed,'Token face selection is missing']};
    thumbSrc=async()=>treasure;previewUrl=async()=>treasure;
    const d={id:uid(),name:'Token regression',entries:[],updated:Date.now()};S.decks.push(d);S.deckId=d.id;S.settings={...DEFAULTS};
    mpcAutofill=async()=>({});await importList('2 Treasure\n3 Dinosaur',false);
    eq('import keeps Treasure quantity',d.entries.find(e=>e.name==='Treasure')?.qty,2);eq('import keeps Dinosaur quantity',d.entries.find(e=>e.name==='Dinosaur')?.qty,3);
    eq('different faces are not merged',d.entries.length,2);
    d.entries=[toEntry(pair,3,'Treasure')];
    await applyCardMatch({e:d.entries[0],deckId:d.id},pair,false);remember();
    eq('both faces are retained',d.entries[0].faces.map(f=>f.name).join('/'),'Dinosaur/Treasure');
    eq('both sides have saved artwork',d.entries[0].faces.every(f=>!!f.custom),true);
    S.settings.dfcMode='front';eq('token pair is independent of ordinary DFC settings',buildSlots().every(slot=>slot.back?.name==='Treasure'),true);
    await applyCardMatch({e:d.entries[0],deckId:d.id,copy:1},pair,false,1);remember();
    eq('one copy can choose one token face',d.entries.map(e=>e.faces.length).join(','),'2,1,2');eq('copy count is preserved',d.entries.reduce((n,e)=>n+e.qty,0),3);
    const chosen=d.entries[1];eq('selected face is Treasure',chosen.faces[0].name,'Treasure');eq('saved metadata preserves the face index',cleanDeck(d).entries[1].scryFace,1);
    eq('shared deck preserves the selected token face',(await makePrintDeck()).deck.entries[1].scryFace,1);
    eq('cached artwork is the Treasure image',await blobToData(await store.get('images',chosen.faces[0].custom)),treasure);
    eq('single token uses no unrelated back',buildSlots().find(slot=>slot.e===chosen).back,null);
    const before=JSON.stringify(chosen), beforeImages=(await store.keys('images')).sort().join(',');
    window.fetch=async(url,opts)=>url===treasure?new Response('error',{status:503}):oldFetch(url,opts);
    try{await applyCardMatch({e:chosen,deckId:d.id},pair,false);failed.push('failed artwork download was accepted');}catch{}
    eq('failed artwork leaves the token unchanged',JSON.stringify(chosen),before);eq('failed pair download leaves no orphan image',(await store.keys('images')).sort().join(','),beforeImages);
    window.fetch=oldFetch;
    let complete;window.fetch=()=>new Promise(resolve=>{complete=resolve;});
    const late=applyCardMatch({e:chosen,deckId:d.id},pair,false,1);
    const other={id:uid(),name:'Other deck',entries:[],updated:Date.now()};S.decks.push(other);S.deckId=other.id;
    complete(new Response(await (await oldFetch(treasure)).blob()));
    try{await late;failed.push('late image wrote into a different deck');}catch{}
    eq('deck switch keeps the original token',JSON.stringify(chosen),before);eq('deck switch leaves no orphan image',(await store.keys('images')).sort().join(','),beforeImages);
    S.deckId=d.id;window.fetch=oldFetch;
    const queries=[];const merfolk={...pair,id:'2e20d047-0d43-4709-919c-0b0f714e9903',name:'Merfolk // Treasure',card_faces:[{...pair.card_faces[0],name:'Merfolk'},pair.card_faces[1]]};
    sf=async url=>{queries.push(new URL(url).searchParams.get('q'));return {data:[pair,merfolk],has_more:false};};
    openCardMatch(chosen);await wait(()=>$$('.token-printing').length===2);
    eq('token picker offers each face',$$('[data-token-face="1"]').length,2);eq('token picker offers both sides',$$('[data-token-face="both"]').length,2);
    $('#matchTokenMode').value='pairs';$('#matchTokenMode').dispatchEvent(new Event('change'));await wait(()=>$$('.token-printing').length===2);
    eq('pair filter searches released double-faced tokens',queries.at(-1).includes('layout:double_faced_token'),true);
    $('.token-printing [data-token-face="1"]').click();await wait(()=>!$('#overlay').classList.contains('on'));remember();
    eq('picker applies the selected back face',chosen.faces.map(f=>f.name).join(','),'Treasure');
    openCardMatch(chosen);await wait(()=>$$('.token-printing').length===2);
    $$('.token-printing')[1].querySelector('[data-token-face="both"]').click();await wait(()=>!$('#overlay').classList.contains('on'));remember();
    eq('another released pair can be chosen',chosen.faces.map(f=>f.name).join('/'),'Merfolk/Treasure');eq('pair clears single-face metadata',chosen.scryFace,undefined);
    const printedSingle=toEntry(pair,1,'Treasure');await cacheTokenPrinting(printedSingle);d.entries=[chosen,printedSingle];remember();
    S.settings={...DEFAULTS,pageSize:'letter',orientation:'portrait',cardRotation:'upright',bleed:0.75,dfcMode:'front',dpi:72};
    let pdf;
    newDoc=(...args)=>{const doc=oldDoc(...args);doc.save=()=>{eq('token pair exports fronts and backs',doc.getNumberOfPages(),2);pdf=doc.output('datauristring').split(',')[1];};return doc;};
    await exportPDF(true);closeModal(true);eq('token PDF exported',!!pdf,true);window.__probeArtifacts={pdf};newDoc=oldDoc;
    const autoEntry=toEntry(pair,1,'Treasure');d.entries=[autoEntry];
    mpcDetails.set('token-test-dinosaur',{identifier:'token-test-dinosaur',name:'Dinosaur',dpi:1200});mpcDetails.set('token-test-treasure',{identifier:'token-test-treasure',name:'Treasure',dpi:600});
    mpcBase=async()=>'/mpc/';mpcCards=async ids=>ids.map(id=>mpcDetails.get(id));mpcSearch=async queries=>new Map(queries.map(q=>[q.query+'|'+q.cardType,['token-test-dinosaur','token-test-treasure']]));
    mpcAutofill=oldAuto;await mpcAutofill({auto:true});eq('automatic token art rejects the wrong token',autoEntry.faces[0].drive,'token-test-treasure');
    d.entries=[toEntry(pair,1,'Treasure')];mpcSearch=async queries=>new Map(queries.map(q=>[q.query+'|'+q.cardType,['token-test-dinosaur']]));
    const missed=await mpcAutofill({auto:true});eq('wrong-only search results remain unselected',d.entries[0].faces[0].drive,undefined);eq('missing correct art is reported',missed.missed.includes('Treasure'),true);
  } catch(err){failed.push(err.stack || err.message);}
  finally {
    window.fetch=oldFetch;sf=oldSf;mpcAutofill=oldAuto;cardRecommendations=oldRecommendations;mpcBase=oldBase;mpcSearch=oldSearch;mpcCards=oldCards;thumbSrc=oldThumb;previewUrl=oldPreview;newDoc=oldDoc;
    mpcDetails.delete('token-test-dinosaur');mpcDetails.delete('token-test-treasure');closeModal(true);Object.assign(S,original);
    for(const key of images)await removeImageIfUnused(key);
    applyMode();renderAll();
  }
  return failed.length?{failed}:true;
})();
