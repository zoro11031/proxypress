(async()=>{
  const saved=structuredClone(S);const fails=[];const check=(name,value)=>{if(!value)fails.push(name);};
  try {
    S.welcomed=true;closeModal(true);
    const c=document.createElement('canvas');c.width=630;c.height=880;c.getContext('2d').fillRect(0,0,630,880);
    const key=await storeImage(await new Promise(r=>c.toBlob(r)));
    const d=deck();d.entries=[{uid:uid(),qty:1,name:'Occupied',faces:[{name:'Front',custom:key}]}];
    let found=false;
    // Deliberately move registration onto a far empty slot while the first slot stays clear.
    for(const inset of [10,20,30,40,50]) for(const margin of [0,2,5,10]) {
      const s=cleanSettings({...DEFAULTS,pageSize:'letter',orientation:'landscape',silhouette:true,cols:4,rows:2,marginX:margin,marginY:margin,regInset:inset,regPattern:3,backs:false});
      const L=layout(s),slots=buildSlots(d,s);
      if(!regConflict(L,s)||regConflict(L,s,slots))continue;
      found=true;
      const result=await runPreflight({settings:s,deck:d,slots});
      check('empty edge positions do not block output',!result.errors.some(e=>e.type==='reg_conflict'));
      break;
    }
    check('fixture exercises a full-grid false conflict',found);
    const s=cleanSettings({...DEFAULTS,silhouette:true,regInset:25,marginX:0,marginY:0,backs:false}),L=layout(s);
    const slots=Array.from({length:L.per},()=>({front:{custom:key},e:d.entries[0]}));
    const result=await runPreflight({settings:s,deck:d,slots,sheetIndices:[7]});
    check('actual overlap identifies original sheet',result.errors.some(e=>e.type==='reg_conflict'&&e.sheet===8));
    const shifted = cleanSettings({...DEFAULTS, ...cameoPaperLayout('landscape'), pageSize:'letter',
      silhouette:true, guides:'none', backs:false, regInset:0});
    const clipped = await runPreflight({settings:shifted,deck:d,sheetIndices:[3]});
    check('clipped marks block export even though the card fits', !clipped.valid
      && clipped.errors.some(e=>e.type==='reg_clip'&&e.sheet===4)
      && !clipped.errors.some(e=>e.type==='trim_clip'));
    return fails.length?{failed:fails}:true;
  }finally{Object.assign(S,saved);renderAll();}
})();
