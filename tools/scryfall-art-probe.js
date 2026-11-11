// Official printings coexist with other providers, paginate, and remain deliberate choices.
(async()=>{
  const saved=JSON.parse(JSON.stringify(S)), oldSf=sf, oldSearch=mpcSearch, oldCards=mpcCards, oldApi=mpcApi, oldFetch=window.fetch, oldRecommendations=cardRecommendations, oldDoc=newDoc;
  const failed=[], images=new Set(), pending=[];
  const eq=(name,a,b)=>{if(a!==b)failed.push(`${name}: got ${JSON.stringify(a)} want ${JSON.stringify(b)}`);};
  const wait=async fn=>{for(let i=0;i<200;i++){if(fn())return;await sleep(20);}throw Error('Timed out waiting for Scryfall artwork');};
  const remember=()=>{for(const e of deck().entries)for(const f of e.faces)if(f.custom)images.add(f.custom);};
  let resolveCommunity, mode='normal', imageFailure=false, holdImage=null, requests=[];
  try{
    if(typeof scryfallArt!=='function')return {failed:['Scryfall art search is missing']};
    closeModal(true);cardRecommendations=async()=>[];S.mode='print';S.settings={...DEFAULTS,dpi:72};applyMode();
    const canvas=document.createElement('canvas');canvas.width=126;canvas.height=176;const ctx=canvas.getContext('2d');ctx.fillStyle='#245779';ctx.fillRect(0,0,126,176);
    const original=await storeImage(await new Promise(r=>canvas.toBlob(r)));images.add(original);
    ctx.fillStyle='#b82b3c';ctx.fillRect(0,0,126,176);const picked=await new Promise(r=>canvas.toBlob(r));
    const png=i=>`https://cards.scryfall.io/png/front/test/printing-${i}.png`;
    const card=i=>({id:'11111111-1111-4111-8111-'+String(i).padStart(12,'0'),name:'Original',set:'tst',set_name:'Test <set> & art',collector_number:String(i),image_uris:{png:png(i)}});
    const pair={id:'33333333-3333-4333-8333-333333333333',name:'Front // Back',card_faces:[{name:'Front',image_uris:{png:png('front')}},{name:'Back',image_uris:{png:png('back')}}]};
    sf=async url=>{
      requests.push(url);
      if(mode==='stale')return new Promise(resolve=>pending.push({url,resolve}));
      if(mode==='down')throw Error('offline');
      if(mode==='pair')return {data:[pair],has_more:false};
      if(mode==='pages')return url.includes('page=2')?{data:[card(62)],has_more:false}:{data:Array.from({length:61},(_,i)=>card(i+1)),has_more:true,next_page:SF+'/cards/search?page=2'};
      return {data:[card(1),{...card(2),image_uris:{png:'https://untrusted.example/image.png'}}],has_more:false};
    };
    let communityCalls=0;
    mpcSearch=async()=>{communityCalls++;return new Promise(resolve=>resolveCommunity=resolve);};
    mpcCards=async()=>[];mpcApi=async()=>({languages:[]});
    window.fetch=(url,...args)=>{
      if(String(url).startsWith('https://cards.scryfall.io/png/front/test/')){
        if(holdImage)return new Promise(resolve=>holdImage.resolve=resolve);
        return Promise.resolve(imageFailure?new Response('failed',{status:503}):new Response(picked,{headers:{'Content-Type':'image/png'}}));
      }
      return oldFetch(url,...args);
    };
    const d={id:uid(),name:'Official art',cardback:{name:'Original source',custom:original},entries:[{uid:uid(),name:'Original',qty:1,faces:[{name:'Original',custom:original,drive:'old-drive-id',auto:true,lowRes:true}]}],updated:Date.now()};S.decks.push(d);S.deckId=d.id;renderAll();
    await openMpcPicker({e:d.entries[0],i:0});await wait(()=>!!$('[data-scryfall]'));
    eq('Scryfall appears while community search is still pending',typeof resolveCommunity,'function');
    eq('Scryfall label is explicit',$('[data-scryfall]').textContent.includes('Scryfall'),true);
    eq('set names are escaped',!!$('#scryfallArt set'),false);
    eq('untrusted image hosts are omitted',$$('[data-scryfall]').length,1);
    eq('search requests individual printings',new URL(requests[0]).searchParams.get('unique'),'prints');
    $('[data-scryfall]').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
    await wait(()=>!!d.entries[0].faces[0].scryArt);remember();
    const face=d.entries[0].faces[0];
    eq('selected image cached locally',(await store.get('images',face.custom)).size,picked.size);
    eq('Scryfall source survives saved-data cleaning',cleanDeck(d).entries[0].faces[0].scryArt,png(1));
    eq('selection clears community source',face.drive,undefined);eq('selection clears placeholder status',isPreview(face),false);
    eq('official scans have no source bleed',face.srcBleed,0);
    const calls=communityCalls;await mpcAutofill({auto:true});eq('auto-fill preserves the selected printing',communityCalls,calls);
    eq('official printing is not republished as an upload',await publishMatchedArt(d.entries[0]),false);
    eq('order bundle includes chosen official image',buildMpcOrder(true).slot,1);
    resolveCommunity(new Map());await sleep(30);mpcSearch=async()=>new Map();
    mode='pages';await openMpcPicker({e:d.entries[0],i:0});await wait(()=>$$('[data-scryfall]').length===60);
    eq('Scryfall pagination has its own control',$('#sfArtMore').style.display,'');
    $('#sfArtMore').click();await wait(()=>$$('[data-scryfall]').length===61);
    $('#sfArtMore').click();await wait(()=>$$('[data-scryfall]').length===62);
    eq('last Scryfall page hides more control',$('#sfArtMore').style.display,'none');closeModal(true);
    mode='normal';imageFailure=true;await openMpcPicker({e:d.entries[0],i:0});await wait(()=>!!$('[data-scryfall]'));
    const before=face.custom, beforeImages=(await store.keys('images')).sort().join(',');$('[data-scryfall]').click();
    await wait(()=>$('#mpcStatus').textContent.includes('could not be downloaded'));
    eq('failed download preserves the chosen image',face.custom,before);eq('failed download leaves no orphan',(await store.keys('images')).sort().join(','),beforeImages);closeModal(true);imageFailure=false;
    const both={uid:uid(),name:'Front // Back',qty:1,kind:'CARD',scryId:pair.id,faces:[{name:'Front',custom:original},{name:'Back',custom:original}]};d.entries=[both];renderAll();mode='pair';
    await openMpcPicker({e:both,i:1});await wait(()=>!!$('[data-scryfall]'));
    eq('back search returns only the matching face',$$('[data-scryfall]').length,1);
    eq('back result uses back artwork',scryfallArt(pair,'Back')[0].index,1);
    $('[data-scryfall]').click();await wait(()=>!!both.faces[1].scryArt);remember();
    eq('back selection preserves front',both.faces[0].custom,original);eq('back selection saves correct face',both.faces[1].scryArt,png('back'));
    let pdf;newDoc=(...args)=>{const doc=oldDoc(...args);doc.save=()=>{eq('double-faced export still has front and back pages',doc.getNumberOfPages(),2);pdf=doc.output('datauristring').split(',')[1];};return doc;};
    await exportPDF(true);closeModal(true);eq('chosen Scryfall art exports to PDF',!!pdf,true);newDoc=oldDoc;
    mode='normal';await openMpcPicker({e:both,i:0});await wait(()=>!!$('[data-scryfall]'));holdImage={};const unchanged=both.faces.map(f=>f.custom).join(',');
    $('[data-scryfall]').click();await wait(()=>!!holdImage.resolve);closeModal(true);holdImage.resolve(new Response(picked,{headers:{'Content-Type':'image/png'}}));holdImage=null;await sleep(80);
    eq('closing during download cancels selection',both.faces.map(f=>f.custom).join(','),unchanged);
    mode='stale';await openMpcPicker({e:both,i:0});await wait(()=>pending.length===1);$('#mpcQ').value='Second';$('#mpcGo').click();await wait(()=>pending.length===2);
    pending[1].resolve({data:[{...card(3),name:'Second'}],has_more:false});await wait(()=>!!$('[data-scryfall]'));
    pending[0].resolve({data:[{...card(4),name:'Stale'}],has_more:false});await sleep(50);
    eq('late results do not replace a newer search',$('#scryfallArt').textContent.includes('Stale'),false);closeModal(true);
    mode='down';await openMpcPicker({e:both,i:0});await wait(()=>$('#mpcStatus').textContent.includes('Scryfall is unavailable'));
    eq('Scryfall failure does not block community results',$('#mpcStatus').textContent.includes('No community art found'),true);
    window.__probeArtifacts={pdf};
  }catch(err){failed.push(err.stack||err.message);}
  finally{
    resolveCommunity?.(new Map());for(const task of pending)task.resolve({data:[],has_more:false});closeModal(true);
    sf=oldSf;mpcSearch=oldSearch;mpcCards=oldCards;mpcApi=oldApi;window.fetch=oldFetch;cardRecommendations=oldRecommendations;newDoc=oldDoc;
    remember();Object.assign(S,saved);for(const key of images)await removeImageIfUnused(key);save();applyMode();renderAll();
  }
  return failed.length?{failed}:true;
})()
