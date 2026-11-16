(async () => {
  S.welcomed=true;closeModal(true);const fails=[];const check=(n,v)=>{if(!v)fails.push(n);};
  const c=document.createElement('canvas');c.width=252;c.height=352;const keys=[];
  for(let i=0;i<12;i++){const ctx=c.getContext('2d');ctx.fillStyle=`hsl(${i*30} 30% 40%)`;ctx.fillRect(0,0,252,352);ctx.fillStyle='#eee1b8';ctx.fillRect(10,220,232,120);keys.push(await storeImage(await new Promise(r=>c.toBlob(r))));}
  deck().entries=Array.from({length:360},(_,i)=>({uid:uid(),name:'Cube card '+(i+1),qty:1,faces:[{name:'Front '+i,custom:keys[i%keys.length]}]}));
  S.settings=cleanSettings({...DEFAULTS,pageSize:'letter',orientation:'landscape',cols:4,rows:2,backs:false});S.showBacks=false;
  const start=performance.now();renderAll();await drawPreview();const renderMs=performance.now()-start;
  check('cube has 45 navigable sheets',$('#sheetJumpSel').options.length===45);
  $('#sheetJumpSel').value='44';$('#sheetJumpSel').dispatchEvent(new Event('change'));await drawPreview();
  check('only the active sheet is rendered',$$('#pages .pg').length===1&&$('#proofSheetLabel').textContent==='Sheet 45 of 45');
  const slider=$('#colorSliders input[type=range][data-k=brightness]');slider.focus();const samples=[];
  for(let i=0;i<30;i++){const t=performance.now();slider.value=String(95+i);slider.dispatchEvent(new Event('input',{bubbles:true}));samples.push(performance.now()-t);}
  check('color tuning preserves input focus',document.activeElement===slider);
  $('#zoom').value='2.1';$('#zoom').dispatchEvent(new Event('input',{bubbles:true}));setWorkspaceView('cards');setWorkspaceView('proof');await sleep(250);
  check('manual zoom survives queued Fit and view switches',S.zoomMode==='manual'&&S.zoom===2.1);
  check('preview caches remain bounded',previewCache.size<=96&&imgCache.size<=8);
  samples.sort((a,b)=>a-b);window.__probeArtifacts={cards:360,sheets:45,renderMs,inputP95Ms:samples[Math.floor(samples.length*.95)],previewEntries:previewCache.size,decodedEntries:imgCache.size};
  return fails.length?{failed:fails}:true;
})();
