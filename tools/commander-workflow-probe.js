(async () => {
  const saved=structuredClone(S), oldSf=sf, oldApi=mpcApi, oldSearch=mpcSearch, oldCards=mpcCards, oldLocal=[...localIndex], oldDownload=download, Real=window.jspdf.jsPDF;
  const failed=[];const check=(name,value)=>{if(!value)failed.push(name);};
  const wait=async fn=>{for(let i=0;i<160;i++){if(fn())return;await sleep(25);}throw new Error('Timed out waiting for artwork workflow');};
  const click=el=>{if(!el)throw new Error('Missing workflow control');el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();const hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);check('workflow control is visible and clickable: '+(el.id||el.textContent.slice(0,30)),r.width>0&&r.height>0&&r.top>=0&&r.bottom<=innerHeight&&(el.contains(hit)||hit?.contains(el)));el.click();};
  try {
    S.welcomed=true;closeModal(true);sf=async()=>({data:[],has_more:false});mpcApi=async()=>({languages:[]});mpcSearch=async()=>new Map();mpcCards=async()=>[];
    const c=document.createElement('canvas');c.width=630;c.height=880;const ctx=c.getContext('2d');ctx.fillStyle='#355b48';ctx.fillRect(0,0,630,880);ctx.fillStyle='#e8d8ac';ctx.fillRect(20,570,590,290);const blob=await new Promise(r=>c.toBlob(r)),key=await storeImage(blob);
    const front=name=>({name,custom:key});
    const elves={uid:uid(),name:'Llanowar Elves',qty:4,faces:[front('Llanowar Elves')]};
    const dfc={uid:uid(),name:'Delver of Secrets',qty:1,faces:[front('Delver of Secrets'),{name:'Insectile Aberration'}]};
    const token={uid:uid(),name:'Treasure token',kind:'TOKEN',qty:1,faces:[front('Treasure'),front('Clue')]};
    const d={id:uid(),name:'Commander reprint fixture',entries:[elves,dfc,token,...Array.from({length:94},(_,i)=>({uid:uid(),name:'Commander card '+i,qty:1,faces:[front('Card '+i)]}))]};
    S.decks=[d];S.deckId=d.id;S.settings=cleanSettings({...DEFAULTS,pageSize:'letter',orientation:'landscape',cols:4,rows:2,dfcMode:'duplex',backs:false});S.showBacks=false;S.zoomMode='fit';renderAll();await drawPreview();
    localIndex.splice(0,localIndex.length,...['Insectile Aberration','Llanowar Elves'].map(name=>({file:new File([blob],name+'.png',{type:'image/png'}),key:normName(name),words:new Set(normName(name).split(' '))})));
    check('Commander has 100 copies and 13 sheets',buildSlots().length===100&&paginate(buildSlots(),layout().per).length===13);
    check('only missing DFC back needs attention',getPrintJobIssues().length===1);
    click($('#btnFilterNeedsArt'));click($('#cardList [data-act=fix-issue]'));await wait(()=>!!$('[data-src-tab=local]'));click($('[data-src-tab=local]'));await wait(()=>!!$('#localArt figure'));
    click($('#localArt figure'));click($('#btnApplyCandidate'));await wait(()=>!$('#overlay').classList.contains('on'));
    check('back correction keeps copy, face and proof location',getPrintJobIssues().length===0&&selectedCopies.has(copyKey(dfc,0))&&S.showBacks&&S.activeSheet===0);
    if(S.filterNeedsArt)click($('#btnFilterNeedsArt'));
    setWorkspaceView('proof');showSheet(0,'front');selectCardCopy(elves.uid,2,0);await drawPreview();click($('#btnProofChangeArt'));
    await wait(()=>!!$('[data-src-tab=local]'));click($('[data-src-tab=local]'));await wait(()=>!!$('#localArt figure'));click($('#localArt figure'));click($('#btnApplyCandidate'));await wait(()=>!$('#overlay').classList.contains('on'));
    check('one physical copy changed and siblings retained art',buildSlots().slice(0,4).map(s=>s.front.custom===key).join(',')==='true,true,false,true');
    check('edited copy remains selected on same sheet',selectedCopies.size===1&&S.activeSheet===0);
    await drawPreview();const selected=$$('#pages img[data-copy]').find(im=>selectedCopies.has(im.dataset.uid+':'+im.dataset.copy));selected.focus();selected.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
    check('proof copy can be selected by keyboard',selectedCopies.size===1);
    switchTab('cutting');click($('#btnCutModeCameo'));showSheet(12,'front');setWorkspaceView('proof');await drawPreview();
    const outputs=[];window.jspdf={...window.jspdf,jsPDF:function(...args){const doc=new Real(...args);doc.save=name=>outputs.push({name,pages:doc.getNumberOfPages()});return doc;}};
    const cuts=[];download=(blob,name)=>cuts.push({blob,name});$('#exportScope').value='current';click($('#btnReviewExport'));await wait(()=>!$('#btnExportPdfTab').disabled);
    await $('#btnExportPdfTab').onclick();
    check('last sheet PDF retains its matching blank back',outputs.length===1&&outputs[0].pages===2&&outputs[0].name.endsWith('-sheet-13.pdf'));
    await $('#btnExportDxfTab').onclick();
    check('matching cut file retains original sheet number',cuts.length===1&&cuts[0].name.endsWith('-sheet-13.dxf'));
    check('final cut file has four occupied card outlines',((await cuts[0].blob.text()).match(/\nPOLYLINE\n/g)||[]).length===4);
    closeModal();setWorkspaceView('proof');await drawPreview();
    return failed.length?{failed}:true;
  } catch(err){return {failed:[...failed,err.stack||err.message]};}
  finally {closeModal(true);sf=oldSf;mpcApi=oldApi;mpcSearch=oldSearch;mpcCards=oldCards;localIndex.splice(0,localIndex.length,...oldLocal);download=oldDownload;window.jspdf={...window.jspdf,jsPDF:Real};Object.assign(S,saved);$('#exportScope').value='all';save();renderAll();}
})();
