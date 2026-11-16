(async () => {
  const saved=structuredClone(S), resolveImport=resolveDeckImport, autofill=mpcAutofill;
  const fails=[];const check=(name,value)=>{if(!value)fails.push(name);};
  const wait=async fn=>{for(let i=0;i<100;i++){if(fn())return;await sleep(20);}throw new Error('Import review did not open');};
  try {
    S.welcomed=true;closeModal(true);
    const canvas=document.createElement('canvas');canvas.width=63;canvas.height=88;
    const key=await storeImage(await new Promise(r=>canvas.toBlob(r)));
    const a={id:uid(),name:'Intended project',entries:[]},b={id:uid(),name:'Other project',entries:[]};S.decks=[a,b];S.deckId=a.id;renderAll();
    const staged=()=>({resolved:[{uid:uid(),scryId:'same-print',scryFace:0,name:'Resolved card',qty:2,faces:[{name:'Front',custom:key}]}],unresolved:[],fallbacks:[],rows:[{sourceLine:'2 Resolved card',section:'Commander',qty:2,outcome:'Resolved'}]});
    resolveDeckImport=async()=>staged();mpcAutofill=async()=>({});
    for(const dismiss of [()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})),()=>$('#overlay').click(),()=>$('#btnReviewCancel').click()]){
      const pending=importList('2 Resolved card',false);await wait(()=>!!$('#btnReviewConfirm'));
      check('add stages without mutating target',a.entries.length===0);
      check('review names destination and source section',$('#modal').textContent.includes(a.name)&&$('#modal').textContent.includes('Commander'));
      dismiss();await pending;check('cancel preserves target and resumable draft',a.entries.length===0&&a.importDraft.text==='2 Resolved card');
    }
    let release;resolveDeckImport=()=>new Promise(r=>release=r);
    const pending=importList('2 Resolved card',false);activateDeck(b.id);renderAll();release(staged());await pending;
    check('slow additive import cannot change either project after switch',a.entries.length===0&&b.entries.length===0);
    closeModal();activateDeck(a.id);renderAll();$('#btnResumeImport').click();
    check('resume restores exact source',$('#listIn').value==='2 Resolved card');
    resolveDeckImport=async()=>staged();const commit=importList($('#listIn').value,false);await wait(()=>!!$('#btnReviewConfirm'));$('#btnReviewConfirm').click();await commit;
    check('explicit commit changes intended project only',a.entries.length===1&&a.entries[0].qty===2&&b.entries.length===0);
    check('successful import clears draft',!a.importDraft);
    return fails.length?{failed:fails}:true;
  } finally {closeModal(true);resolveDeckImport=resolveImport;mpcAutofill=autofill;Object.assign(S,saved);save();renderAll();}
})();
