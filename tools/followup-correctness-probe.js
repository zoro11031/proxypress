(async()=>{
 const saved=structuredClone(S),oldSf=sf,oldCollection=fetchCollection,oldApi=mpcApi,oldSearch=mpcSearch,oldCards=mpcCards,Real=window.jspdf.jsPDF,failed=[];
 const check=(n,v)=>{if(!v)failed.push(n);};
 try{
  S.welcomed=true;closeModal(true);const c=document.createElement('canvas');c.width=630;c.height=880;c.getContext('2d').fillRect(0,0,630,880);const key=await storeImage(await new Promise(r=>c.toBlob(r)));
  const e={uid:uid(),name:'Copy routing fixture',qty:20,faces:[{name:'Front',custom:key},{name:'Back',custom:key}]};deck().entries=[e,{uid:uid(),qty:0,name:'Zero',faces:[{name:'Missing'}]}];S.settings=cleanSettings({...DEFAULTS,backs:false,dfcMode:'duplex',cols:4,rows:2,pageSize:'letter',orientation:'portrait'});
  const target=findIssueTarget({uid:e.uid,copy:17,faceIdx:1,side:'back',sheet:3});check('exact copy resolves to its own sheet',target.copyIndex===17&&target.sheetIndex===2&&target.side==='back');
  check('zero quantity creates no issues',!getPrintJobIssues().some(x=>x.e?.name==='Zero'));
  renderAll();setWorkspaceView('cards');const qty=$('#cardList [data-act=qty]');qty.focus();qty.value='123';qty.dispatchEvent(new Event('change',{bubbles:true}));check('quantity keeps input identity and focus',qty.isConnected&&document.activeElement===qty&&e.qty===123);e.qty=20;
  const staged={resolved:[{...e,qty:1},{...e,qty:1}],unresolved:[],fallbacks:[],rows:[{sourceLine:'1 A',section:'Main',qty:1,outcome:'Resolved',entry:{...e,qty:1}},{sourceLine:'1 B',section:'Sideboard',qty:1,outcome:'Resolved',entry:{...e,qty:1}}]};
  const decision=reviewReplacement(captureDeckRevision(deck()),staged,false),section=$$('[data-import-section]')[1];section.checked=false;section.dispatchEvent(new Event('change'));check('section inclusion changes staged copies only',staged.resolved.length===1&&e.qty===20);closeModal();check('section review cancels without commit',await decision===false);
  const real=await renderFace(e.faces[0],150,true,0,S.settings),trim=await renderPrintColors(e.faces[0],S.settings,150);check('trim dimensions match print crop',trim.width===Math.round(S.settings.cardW*150/25.4)&&trim.height===Math.round(S.settings.cardH*150/25.4));
  const output=[];window.jspdf={...window.jspdf,jsPDF:function(...args){const doc=new Real(...args),add=doc.addImage.bind(doc);doc.addImage=(data,fmt,x,y,w,h,...rest)=>{check('foil sample stays within page',x>=0&&y>=0&&x+w<=doc.internal.pageSize.getWidth()+.01&&y+h<=doc.internal.pageSize.getHeight()+.01);return add(data,fmt,x,y,w,h,...rest);};doc.save=()=>{output.push(doc.getNumberOfPages());(window.__probeArtifacts ||= {foilPdfs:[]}).foilPdfs.push(doc.output('datauristring'));};return doc;}};
  selectCardCopy(e.uid,0,1);S.showBacks=true;await printFoilTestSheet();check('Letter portrait paginates full-size samples',output[0]===2);
  for(const settings of [{pageSize:'a4',orientation:'portrait'},{pageSize:'letter',orientation:'landscape'},{pageSize:'custom',pageW:100,pageH:160,orientation:'portrait'}]){S.settings=cleanSettings({...S.settings,...settings});await printFoilTestSheet();}
  check('all foil paper fixtures export',output.length===4);
  let calls=0;sf=async()=>{calls++;if(calls===1)throw Error('Temporary outage');return {data:[]};};mpcApi=async()=>({results:[],data:[]});mpcSearch=async()=>new Map();mpcCards=async()=>[];
  await openMpcPicker({e,i:0});await sleep(100);$('#btnRetrySf').click();await sleep(100);check('first printings request can retry',calls===2);
  closeModal(true);let pageCalls=0;sf=async()=>{pageCalls++;if(pageCalls===1)return {data:[],has_more:true,next_page:SF+'/cards/search?q=second'};if(pageCalls===2)throw Error('Second page unavailable');return {data:[]};};await openMpcPicker({e,i:0});$('#sfArtMore').click();await sleep(100);$('#btnRetrySf').click();await sleep(100);check('pagination cursor survives failure and retry',pageCalls===3);
  closeModal(true);const owner=deck(),text='2 Misspelled (PCY) 1';$('#listIn').value=text;owner.importDraft=typeof makeImportDraft==='function' ? makeImportDraft(text) : {id:uid(),text};
  const destination={id:uid(),name:'Other project',entries:[]};S.decks.push(destination);let release,entered=false;
  fetchCollection=async requests=>{entered=true;await new Promise(resolve=>release=resolve);return {found:requests.map(req=>({req,card:{id:'11111111-1111-1111-1111-111111111111',name:'Corrected',set:'pcy',collector_number:'1',layout:'normal',image_uris:{png:c.toDataURL()}}})),missing:[]};};
  activeMissingSuggestions=[{projectId:owner.id,draftId:owner.importDraft.id,sourceText:text,lineIndex:0,req:{qty:2,name:'Misspelled',set:'pcy',cn:'1'},choices:[{name:'Corrected'}]}];
  $('#importNote').innerHTML='<button data-item="0" data-suggest-add="0">Add</button>';$('#importNote button').click();
  for(let i=0;i<100&&!entered;i++)await sleep(10);check('correction enters staged resolver',entered);if(!entered)return {failed};
  S.deckId=destination.id;renderAll();release();await sleep(100);
  check('late correction does not affect another project',destination.entries.length===0&&owner.entries[0].qty===20&&owner.importDraft.text===text);
  return failed.length?{failed}:true;
 }finally{closeModal(true);sf=oldSf;fetchCollection=oldCollection;mpcApi=oldApi;mpcSearch=oldSearch;mpcCards=oldCards;window.jspdf={...window.jspdf,jsPDF:Real};Object.assign(S,saved);renderAll();}
})();
