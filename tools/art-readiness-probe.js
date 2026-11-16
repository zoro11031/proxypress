(async()=>{
  const saved=structuredClone(S),originalLoad=loadImage,failed=[];const check=(n,v)=>{if(!v)failed.push(n);};
  const wait=async fn=>{for(let i=0;i<200;i++){if(fn())return;await sleep(20);}throw Error('Artwork readiness did not settle');};
  try{
    S.welcomed=true;closeModal(true);const canvas=document.createElement('canvas');canvas.width=630;canvas.height=880;const url=canvas.toDataURL();
    const entry={uid:uid(),name:'Retry source fixture',qty:1,faces:[{name:'Front',png:url,normal:url,mpcDpi:600}]};deck().entries=[entry];S.settings=cleanSettings({...DEFAULTS,backs:false});S.mode='print';S.showBacks=false;
    let available=false,requests=0;loadImage=async src=>{if(src===url){requests++;if(!available)throw Error('Injected retryable source failure');}return originalLoad(src);};
    renderAll();const quantity=$('#cardList [data-act=qty]');quantity.focus();$('#btnReviewExport').click();
    await wait(()=>!!$('#exportReview [data-retry-issue]'));
    check('source failure blocks output and offers retry',$('#btnExportPdfTab').disabled&&$('#barStatus').textContent.startsWith('Blocked'));
    check('source failure appears in Needs attention',getPrintJobIssues().some(issue=>issue.type==='unreadable'&&issue.retryable));
    check('validation updates preserve quantity control',$('#cardList [data-act=qty]')===quantity);
    const count=requests;await runPreflight();check('failed-source cache avoids repeated fetches',requests===count);
    available=true;$('#exportReview [data-retry-issue]').click();
    await wait(()=>latestPrintReview?.key===printJobKey()&&!latestPrintReview.issues.some(issue=>issue.type==='remote_art'));
    check('retry unblocks the same job',!$('#btnExportPdfTab').disabled);
    check('retry clears failed-source issue',!getPrintJobIssues().some(issue=>issue.type==='unreadable'));
    artValidationCache.clear();artValidationBySource.clear();let release,started=false;const gate=new Promise(r=>release=r);
    loadImage=async src=>{if(src===url){started=true;await gate;}return originalLoad(src);};
    renderGuideTab();await wait(()=>started);S.settings.offsetX=500;renderGuideTab();release();
    await wait(()=>latestPrintReview?.key===printJobKey()&&latestPrintReview.issues.some(issue=>issue.type==='trim_clip'));
    check('late earlier review cannot overwrite changed geometry',$('#barStatus').textContent.startsWith('Blocked')&&$('#btnExportPdfTab').disabled);
    return failed.length?{failed}:true;
  }catch(err){return {failed:[...failed,err.stack||err.message]};}finally{loadImage=originalLoad;closeModal(true);Object.assign(S,saved);save();renderAll();}
})();
