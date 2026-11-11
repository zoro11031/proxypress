// Upload matching, skipping, face association, shared discovery and local copies.
(async()=>{
  const saved=JSON.parse(JSON.stringify(S)), oldSf=sf, oldApi=mpcApi, oldSearch=mpcSearch, oldCards=mpcCards, oldRecommendations=cardRecommendations, oldConfirm=window.confirm;
  const failed=[], local=new Set(), uploaded=new Set();
  const eq=(name,a,b)=>{if(a!==b)failed.push(`${name}: got ${JSON.stringify(a)} want ${JSON.stringify(b)}`);};
  const wait=async fn=>{for(let i=0;i<200;i++){if(fn())return;await sleep(25);}throw Error('Timed out waiting for instance artwork');};
  const remember=()=>{for(const e of deck().entries)for(const f of e.faces)if(f.custom)local.add(f.custom);};
  const search=async q=>(await shareRequest('/art?q='+encodeURIComponent(q))).art;
  try{
    closeModal(true);cardRecommendations=async()=>[];window.confirm=()=>true;S.mode='print';S.settings={...DEFAULTS};applyMode();
    const canvas=document.createElement('canvas');canvas.width=252;canvas.height=352;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#184b67';ctx.fillRect(0,0,252,352);ctx.fillStyle='#e4c882';ctx.fillRect(12,16,228,320);
    const blob=await new Promise(r=>canvas.toBlob(r)), image=canvas.toDataURL();
    const large=new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="1260" height="1760"><rect width="1260" height="1760"/></svg>'],{type:'image/svg+xml'});
    const thumb=await compactShareImage(large,true,352), url=URL.createObjectURL(thumb);
    const thumbImage=await loadImage(url);eq('search thumbnails have bounded dimensions',Math.max(thumbImage.naturalWidth,thumbImage.naturalHeight)<=352,true);URL.revokeObjectURL(url);imgCache.delete(url);
    const card={id:'11111111-1111-4111-8111-111111111111',oracle_id:'22222222-2222-4222-8222-222222222222',name:'Lightning Bolt',set:'tst',set_name:'Test <set>',collector_number:'1',layout:'normal',image_uris:{png:image,normal:image}};
    const dfc={...card,id:'33333333-3333-4333-8333-333333333333',name:'Front // Back',layout:'transform',image_uris:undefined,card_faces:[{name:'Front',image_uris:card.image_uris},{name:'Back',image_uris:card.image_uris}]};
    const queries=[];
    sf=async url=>{queries.push(url);return {data:[decodeURIComponent(url).toLowerCase().includes('back')?dfc:card],has_more:false};};
    mpcApi=async()=>({languages:[]});mpcSearch=async()=>new Map();mpcCards=async()=>[];
    const d={id:uid(),name:'Upload matching',entries:[],updated:Date.now()};S.decks.push(d);S.deckId=d.id;renderAll();
    const file=new File([blob],'Lightning Bolt.png',{type:blob.type});
    await uploadImages([file]);remember();
    eq('upload opens optional matching',!!$('#matchSkip'),true);
    eq('upload matches card identities without duplicate printings',new URL(queries.at(-1)).searchParams.get('unique'),'cards');
    eq('upload preview is available',!!$('#matchUploadPreview'),true);
    eq('prompt explains server visibility',$('#modal .hint').textContent.includes('everyone on this server'),true);
    $('#matchSkip').click();
    eq('skip keeps the local image',!!d.entries[0].faces[0].custom,true);
    eq('skip leaves identity unmatched',d.entries[0].scryId,undefined);
    eq('skip does not publish artwork',(await search('Lightning Bolt')).length,0);
    openCardMatch(d.entries[0]);eq('skipped uploads can be matched later',!!$('#matchSkip'),true);$('#matchSkip').click();
    await uploadImages([file,file]);remember();
    eq('batch match shows position',$('#modal .hd b').textContent.includes('1 of 2'),true);
    $('#matchSkipAll').click();eq('skip remaining closes matching',$('#overlay').classList.contains('on'),false);
    await uploadImages([file]);remember();const matched=d.entries.at(-1), original=matched.faces[0].custom;
    await wait(()=>!!$('[data-match="0"]'));$('[data-match="0"]').click();
    await wait(()=>!$('#overlay').classList.contains('on'));
    eq('match keeps uploaded image',matched.faces[0].custom,original);
    eq('match stores canonical card',matched.scryId,card.id);
    let hits=await search('Lightning Bolt');eq('matched upload is discoverable',hits.length,1);uploaded.add(hits[0].id);
    eq('matched upload uses server-verified name',hits[0].name,'Lightning Bolt');
    await removeEntry(matched);
    eq('deleting source deck entry retains shared artwork',(await search('Lightning Bolt')).length,1);
    const other={id:uid(),name:'Another user deck',entries:[toEntry(card,1)],updated:Date.now()};S.decks.push(other);S.deckId=other.id;renderAll();
    await openMpcPicker({e:other.entries[0],i:0});await wait(()=>!!$('#mpcGrid [data-instance]'));
    const result=$('#mpcGrid [data-instance]');eq('shared art is labeled',result.textContent.includes('Uploaded here'),true);
    result.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
    await wait(()=>!!other.entries[0].faces[0].custom);remember();
    eq('shared selection keeps a local image',(await store.get('images',other.entries[0].faces[0].custom)).size,blob.size);
    eq('shared selection uses independent storage',other.entries[0].faces[0].custom!==original,true);
    const dt=new DataTransfer();dt.items.add(file);const input=$('#fileFace');input.files=dt.files;faceTarget={e:other.entries[0],i:0};
    await input.onchange({target:input});remember();
    eq('uploading to a matched card deduplicates search entries',(await search('Lightning Bolt')).length,1);
    await uploadImages([new File([blob],'Back.png',{type:blob.type})]);remember();const back=other.entries.at(-1);
    await wait(()=>!!$('[data-token-face="1"]'));
    eq('paired face choices fit the dialog',$('.token-printing').getBoundingClientRect().right<=$('#modal').getBoundingClientRect().right,true);
    $('[data-token-face="1"]').click();await wait(()=>!$('#overlay').classList.contains('on'));
    eq('back upload preserves one image face',back.faces.length,1);eq('back upload stores correct face',back.scryFace,1);
    eq('face choice survives saved-data cleaning',cleanDeck(other).entries.at(-1).scryFace,1);
    hits=await search('Back');eq('back artwork is discoverable',hits[0]?.face,'Back');for(const hit of hits)uploaded.add(hit.id);
    eq('back upload does not pollute front search',(await search('Front')).length,0);
    await openMpcPicker({e:other.entries[0],i:0});await wait(()=>!!$('#mpcGrid [data-remove-art]'));
    $('#mpcGrid [data-remove-art]').click();await wait(()=>!$('#mpcGrid [data-instance]'));
    eq('removed upload leaves search',(await search('Lightning Bolt')).length,0);
    eq('removing shared art keeps selected local copies',!!(await store.get('images',other.entries[0].faces[0].custom)),true);
  }catch(e){failed.push(e.stack||e.message);}
  finally{
    closeModal(true);sf=oldSf;mpcApi=oldApi;mpcSearch=oldSearch;mpcCards=oldCards;cardRecommendations=oldRecommendations;window.confirm=oldConfirm;
    for(const id of uploaded){try{await shareRequest('/art/'+id+'/delete',{});}catch{}}
    remember();Object.assign(S,saved);for(const key of local)await removeImageIfUnused(key);save();applyMode();renderAll();
  }
  return failed.length?{failed}:true;
})()
