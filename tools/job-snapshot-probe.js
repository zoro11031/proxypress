(async()=>{
  const saved=structuredClone(S),failed=[];const check=(n,v)=>{if(!v)failed.push(n);};
  try{
    S.welcomed=true;closeModal(true);const c=document.createElement('canvas');c.width=630;c.height=880;const key=await storeImage(await new Promise(r=>c.toBlob(r)));
    deck().entries=[{uid:uid(),name:'Snapshot',qty:11,faces:[{name:'Front',custom:key}]}];
    S.settings=cleanSettings({...DEFAULTS,...cameoPaperLayout('landscape'),pageSize:'letter',silhouette:true,cols:4,rows:2,backs:false});
    const job=buildPrintJob(), svg=cutSvg(1,job), dxf=cutDxf(1,job), studio=await cutStudio3(1,job);
    const position=slotPos(job.layout,2,false,job.settings),transform=makeT(job.layout,false,job.settings).x(position.x);
    S.settings.pageSize='a4';S.settings.orientation='portrait';S.settings.offsetX=500;S.settings.gap=9;deck().entries[0].qty=1;
    check('snapshot SVG and DXF ignore later live state',svg===cutSvg(1,job)&&dxf===cutDxf(1,job));
    const after=await cutStudio3(1,job);check('snapshot Studio bytes ignore later live state',studio.length===after.length&&studio.every((v,i)=>v===after[i]));
    check('snapshot transforms ignore live offsets',makeT(job.layout,false,job.settings).x(position.x)===transform);
    const result=await runPreflight({settings:job.settings,deck:job.project,layout:job.layout,slots:job.slots,printer:job.printer,calibration:job.calibration});
    check('snapshot validation ignores live geometry and quantities',result.valid&&result.stats.cards===11&&result.stats.sheets===2);
    const last=job.sheets[1];last.slots[0].front.custom='missing-artwork-for-snapshot-check';
    const missing=await runPreflight({settings:job.settings,deck:job.project,layout:job.layout,slots:last.slots,sheetIndices:[1]});
    check('scoped artwork warning retains original sheet number',missing.errors.some(e=>e.type==='missing_art'&&e.sheet===2));
    return failed.length?{failed}:true;
  }catch(err){return {failed:[...failed,err.stack||err.message]};}finally{Object.assign(S,saved);save();renderAll();}
})();
