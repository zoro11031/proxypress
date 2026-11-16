(async()=>{
  const saved=structuredClone(S),oldInfo=mpcCardInfo,oldDownload=download,failed=[];const check=(n,v)=>{if(!v)failed.push(n);};
  try{
    S.welcomed=true;closeModal(true);const c=document.createElement('canvas');c.width=630;c.height=880;c.getContext('2d').fillRect(0,0,630,880);
    const original=await new Promise(r=>c.toBlob(r)),key=await storeImage(original);c.getContext('2d').fillStyle='#ffeedd';c.getContext('2d').fillRect(0,0,630,880);const replacement=await storeImage(await new Promise(r=>c.toBlob(r)));
    const d={id:uid(),name:'Captured order',entries:[{uid:uid(),name:'Local card',qty:2,faces:[{name:'Front',custom:key}]}],cardback:{name:'Back',custom:key}};S.decks=[d];S.deckId=d.id;S.settings={...DEFAULTS,backImage:null};S.mpc={...MPC_DEFAULTS,stock:'(S33) Superior Smooth',foil:false};
    let resume,started=false;const gate=new Promise(r=>resume=r);mpcCardInfo=async()=>{started=true;await gate;return f=>({file:null,query:siteQuery(f.name)});};const downloads=[];download=(blob,name)=>downloads.push({blob,name});
    const pending=exportMpcZip(true);while(!started)await sleep(10);
    d.name='Changed project';d.entries[0].qty=1;d.entries[0].faces[0].custom=replacement;d.cardback.custom=replacement;S.mpc.stock='(P10) Plastic';S.mpc.foil=true;
    await removeImageIfUnused(key);check('in-progress order retains its artwork bytes',!!await store.get('images',key));
    resume();await pending;check('order keeps captured project filename',downloads.length===1&&downloads[0].name.startsWith('Captured order'));
    const bytes=new Uint8Array(await downloads[0].blob.arrayBuffer()),view=new DataView(bytes.buffer),decoder=new TextDecoder(),files=[];let offset=0;
    while(view.getUint32(offset,true)===0x04034b50){const length=view.getUint32(offset+18,true),nameSize=view.getUint16(offset+26,true),extra=view.getUint16(offset+28,true),start=offset+30;const name=decoder.decode(bytes.slice(start,start+nameSize)),dataStart=start+nameSize+extra;files.push({name,data:bytes.slice(dataStart,dataStart+length)});offset=dataStart+length;}
    const xml=decoder.decode(files.find(f=>f.name.endsWith('.xml')).data);check('order XML uses captured stock, finish and copies',xml.includes('<stock>(S33) Superior Smooth</stock>')&&xml.includes('<foil>false</foil>')&&xml.includes('<quantity>2</quantity>'));
    const image=files.find(f=>f.name.startsWith('cards/')).data,expected=new Uint8Array(await original.arrayBuffer());check('order ZIP includes captured artwork',image.length===expected.length&&image.every((value,i)=>value===expected[i]));
    check('obsolete artwork is released after export',!await store.get('images',key));
    return failed.length?{failed}:true;
  }catch(err){return {failed:[...failed,err.stack||err.message]};}finally{mpcCardInfo=oldInfo;download=oldDownload;closeModal(true);Object.assign(S,saved);save();renderAll();}
})();
