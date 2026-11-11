// Public shares, compact offline files, original restoration, and mobile save UI.
(async () => {
  const saved=JSON.parse(JSON.stringify(S)), oldDownload=download, oldFetch=window.fetch, oldMobile=mobileDownloads;
  const oldRead=FileReader.prototype.readAsDataURL, oldConfirm=window.confirm;
  const oldRecommendations=cardRecommendations;
  const failed=[], created=[], shares=[], downloads=[];
  const eq=(name,a,b)=>{if(a!==b)failed.push(`${name}: got ${JSON.stringify(a)} want ${JSON.stringify(b)}`);};
  const trackDeck=d=>created.push(...printDeckKeys(d,S.settings));
  let maxRead=0, reads=0;
  try {
    closeModal(true);cardRecommendations=async()=>[];S.mode='print';S.settings={...DEFAULTS,offsetX:2,scaleX:99};applyMode();
    const canvas=document.createElement('canvas');canvas.width=1260;canvas.height=1760;
    const ctx=canvas.getContext('2d');
    for(let y=0;y<1760;y+=10)for(let x=0;x<1260;x+=10){ctx.fillStyle=`rgb(${(x*17+y*13)%256},${(x*3+y*7)%256},${(x*11+y*19)%256})`;ctx.fillRect(x,y,10,10);}
    const blob=await new Promise(r=>canvas.toBlob(r,'image/jpeg',1));
    const d={id:uid(),name:'Share <deck> & "art"',entries:[],updated:Date.now()};S.decks.push(d);S.deckId=d.id;
    for(let i=0;i<85;i++){const key=await storeImage(blob);created.push(key);d.entries.push({uid:uid(),qty:1,name:'Card '+i,custom:true,faces:[{name:'Card '+i,custom:key}],tokens:[]});}
    FileReader.prototype.readAsDataURL=function(b){reads++;maxRead=Math.max(maxRead,b.size);return oldRead.call(this,b);};
    renderAll();
    const result=await createShareLink();
    eq('85-card share succeeds',!!result,true);if(!result)throw Error($('#toast').textContent);
    shares.push(result.id);
    eq('share never base64-encodes original images',reads,0);
    eq('ready dialog escapes names',$('#modal').querySelector('deck'),null);
    eq('copyable URL',$('#deckShareUrl').value,result.url);
    closeModal(true);
    const response=await fetch('/share/'+result.id+'/deck.json'), raw=await response.text(), meta=JSON.parse(raw);
    eq('manifest references 85 keys',Object.keys(meta.images).length,85);
    eq('binary-identical art has one server hash',new Set(Object.values(meta.images)).size,1);
    eq('manifest stays small',raw.length<40000,true);
    eq('manifest excludes base64',raw.includes('data:image'),false);
    eq('share excludes sender calibration',meta.settings.offsetX,undefined);
    const copy=await importServerDeck(result.id,meta,true);trackDeck(copy);
    eq('link opens all 85 cards',copy.entries.length,85);
    eq('link import reuses identical local artwork',new Set(copy.entries.map(e=>e.faces[0].custom)).size,1);
    eq('link keeps recipient calibration',S.settings.offsetX,2);
    eq('link keeps original image bytes',(await store.get('images',copy.entries[0].faces[0].custom)).size,blob.size);
    // One compact image is enough to exercise JSON. The 85-card link above guards the reported count.
    d.entries=d.entries.slice(0,2);S.deckId=d.id;renderAll();
    download=(b,n)=>downloads.push({blob:b,name:n});
    await $('#printDeckOut').onclick();
    eq('JSON exported',downloads.length,1);
    const data=await readPrintDeck(downloads[0].blob);shares.push(data.originalShare.token);
    eq('JSON deduplicates embedded copies',Object.keys(data.images).length,1);
    eq('JSON tags original server reference',/^[a-f0-9]{64}$/.test(data.originalShare.images[d.entries[0].faces[0].custom]),true);
    eq('base64 writer has bounded chunks',maxRead<=196608,true);
    const embedded=await (await oldFetch(data.images[d.entries[0].faces[0].custom])).blob();
    eq('embedded art is smaller than original',embedded.size<blob.size,true);
    eq('JSON uses compact JPEG for card faces',embedded.type,'image/jpeg');
    const imported=await importPrintDeck(data);trackDeck(imported);
    eq('JSON import restores full original bytes',(await store.get('images',imported.entries[0].faces[0].custom)).size,blob.size);
    window.fetch=(url,...args)=>String(url).includes('/share/')&&String(url).includes('/images/')?Promise.reject(Error('offline')):oldFetch(url,...args);
    const offline=await importPrintDeck(data);trackDeck(offline);
    eq('offline JSON uses embedded image',(await store.get('images',offline.entries[0].faces[0].custom)).size,embedded.size);
    window.fetch=oldFetch;
    const alpha=document.createElement('canvas');alpha.width=100;alpha.height=100;alpha.getContext('2d').fillRect(30,30,20,20);
    const alphaBlob=await new Promise(r=>alpha.toBlob(r)), compact=await compactShareImage(alphaBlob,false);
    eq('editable layers keep transparency',compact.type,'image/png');
    const bytes=new Uint8Array(196608*2+1);for(let i=0;i<bytes.length;i++)bytes[i]=i%251;
    const chunked=new Blob([bytes],{type:'image/png'}), chunkJson=JSON.parse('{'+await (await imageJsonBlob('test',chunked)).text()+'}');
    eq('base64 chunks preserve remainder bytes',chunkJson.test,await new Promise((r,j)=>{const f=new FileReader();f.onload=()=>r(f.result);f.onerror=j;oldRead.call(f,chunked);}));
    download=oldDownload;mobileDownloads=()=>true;
    download(downloads[0].blob,downloads[0].name);
    eq('mobile waits for a fresh save tap',!!$('#readyFileSave'),true);
    eq('mobile keeps .json filename',$('#readyFileSave').download,downloads[0].name);
    eq('mobile link stays attached',$('#readyFileSave').isConnected,true);
    eq('mobile download has real bytes',(await (await oldFetch($('#readyFileSave').href)).blob()).size,downloads[0].blob.size);
    closeModal(true);
    window.confirm=()=>true;
    await $('#manageShares').onclick();
    eq('management lists published links',!!$(`[data-share-remove="${result.id}"]`),true);
    const btn=$(`[data-share-remove="${result.id}"]`);btn.click();
    for(let i=0;i<100&&btn.isConnected;i++)await sleep(20);
    eq('management removes link row',btn.isConnected,false);
    if(!btn.isConnected)shares.splice(shares.indexOf(result.id),1);
    closeModal(true);
    window.__probeArtifacts={url:result.url,originalBytes:blob.size,compactBytes:embedded.size,jsonBytes:downloads[0].blob.size,manifestBytes:raw.length,maxBase64Read:maxRead};
  }catch(e){failed.push(e.stack||e.message);}
  finally{
    FileReader.prototype.readAsDataURL=oldRead;window.fetch=oldFetch;download=oldDownload;mobileDownloads=oldMobile;window.confirm=oldConfirm;cardRecommendations=oldRecommendations;closeModal(true);
    for(const id of shares){try{await shareRequest('/shares/'+id+'/delete',{});}catch{}}
    Object.assign(S,saved);for(const key of new Set(created))await removeImageIfUnused(key);save();applyMode();renderAll();
  }
  return failed.length?{failed}:true;
})()
