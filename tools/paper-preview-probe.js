// Every supported paper size must be selectable and synchronized in both places.
(() => {
  const original=JSON.parse(JSON.stringify(S)), failed=[];
  const eq=(name,a,b)=>{if(a!==b)failed.push(`${name}: got ${JSON.stringify(a)} want ${JSON.stringify(b)}`);};
  try {
    closeModal(true);S.mode='print';S.printer='et2800';S.settings={...DEFAULTS,scaleX:99,offsetX:2};applyMode();renderAll();
    const choices=FIELDS.find(f=>f.k==='pageSize').opts.map(([value])=>value);
    const options=()=>[...$('#quickPaper').options].map(o=>o.value).join(',');
    const want=choices.join(',');syncPreviewControls();
    eq('preview offers all paper sizes in settings order',options(),want);
    for(const paper of choices) {
      if(![...$('#quickPaper').options].some(o=>o.value===paper))continue;
      $('#quickPaper').value=paper;$('#quickPaper').dispatchEvent(new Event('change',{bubbles:true}));syncPreviewControls();
      eq(paper+' updates settings',S.settings.pageSize,paper);
      eq(paper+' updates print form',$('#paperForm [data-k="pageSize"]').value,paper);
      eq(paper+' keeps full stable list',options(),want);
      eq(paper+' keeps calibration',S.settings.offsetX,2);
      eq(paper+' keeps scale',S.settings.scaleX,99);
    }
    eq('custom opens print setup',$('#tab-setup').classList.contains('on'),true);
    eq('custom dimensions are visible',$('#paperForm').closest('details').open,true);
    eq('custom width receives focus',document.activeElement?.id,'setting-pageW');
    for(const paper of choices) {
      const input=$('#paperForm [data-k="pageSize"]');input.value=paper;input.dispatchEvent(new Event('change',{bubbles:true}));syncPreviewControls();
      eq('advanced '+paper+' updates preview',$('#quickPaper').value,paper);
      eq('advanced '+paper+' never appends a special option',options(),want);
    }
  }catch(err){failed.push(err.stack||err.message);}
  finally{Object.assign(S,original);applyMode();renderAll();}
  return failed.length?{failed}:true;
})()
