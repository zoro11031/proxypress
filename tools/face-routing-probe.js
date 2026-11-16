(async () => {
  const saved=structuredClone(S), picker=openMpcPicker, fails=[];const check=(n,v)=>{if(!v)fails.push(n);};
  try {
    S.welcomed=true;closeModal(true);const c=document.createElement('canvas');c.width=63;c.height=88;const key=await storeImage(await new Promise(r=>c.toBlob(r)));
    const d=deck();const dfc={uid:uid(),name:'Double face',qty:2,faces:[{name:'Front',custom:key},{name:'Reverse'}]};
    d.entries=[{uid:uid(),name:'Padding',qty:7,faces:[{name:'Padding',custom:key}]},dfc];
    S.settings=cleanSettings({...DEFAULTS,pageSize:'letter',orientation:'landscape',cols:4,rows:2,dfcMode:'separate',backs:false});renderAll();
    const issue=getPrintJobIssues().find(issue=>issue.uid===dfc.uid),target=findIssueTarget(issue);
    check('separated reverse routes to its own front slot and sheet',target.i===1&&target.side==='front'&&target.sheetIndex===1&&target.copyIndex===0);
    showSheet(target.sheetIndex,target.side);selectCardCopy(target.entryId,target.copyIndex,target.i);await drawPreview();
    let chosen;openMpcPicker=target=>chosen=target;$('#btnProofChangeArt').click();
    check('proof Change art retains selected face and copy',chosen?.i===1&&chosen.copies[0].copies[0]===0);
    await applyArtChoice(chosen,1,f=>{f.custom=key;f.manual=true;});
    check('separated face edit does not change sibling',buildSlots().filter(slot=>slot.fi===1).map(slot=>!!slot.front.custom).join(',')==='true,false');
    const token={uid:uid(),name:'Paired token',kind:'TOKEN',qty:1,faces:[{name:'Front',custom:key},{name:'Back'}]};d.entries=[token];S.settings.dfcMode='front';
    check('paired tokens still require backs in front-only card mode',getPrintJobIssues().some(issue=>issue.faceIdx===1));
    token.faces[1].custom=key;S.settings.backs=true;
    const preflight=await runPreflight();
    check('all distinct backs do not require an unused common back',!preflight.errors.some(issue=>issue.type==='back_image'));
    return fails.length?{failed:fails}:true;
  } finally {openMpcPicker=picker;Object.assign(S,saved);save();renderAll();}
})();
