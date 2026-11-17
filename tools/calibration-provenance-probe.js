(async () => {
  const original=structuredClone(S),fails=[];const check=(name,value)=>{if(!value)fails.push(name);};
  try {
    S.welcomed=true;closeModal(true);
    const c=document.createElement('canvas');c.width=63;c.height=88;
    const key=await storeImage(await new Promise(r=>c.toBlob(r)));
    deck().entries=[{uid:uid(),name:'Double face',qty:1,faces:[{name:'Front',custom:key},{name:'Back',custom:key}]}];
    S.settings=cleanSettings({...DEFAULTS,pageSize:'letter',orientation:'landscape',duplexMethod:'manual',duplexFlip:'short',dfcMode:'duplex',backs:false});
    const profile={id:uid(),name:'Scoped fixture',printer:S.printer,settings:{'letter/landscape':{offsetX:1,offsetY:2,scaleX:100,scaleY:100,byDuplex:{'manual/short':{backOffsetX:2,backOffsetY:3,backScaleX:100,backScaleY:100,backRotate:0}}}}};
    S.calibrationProfiles.push(profile);applyCalProfile(profile);
    let status=getCalibrationStatus();check('front and matching duplex have independent measured provenance',status.front.status==='Measured'&&status.back.status==='Measured');
    $('#calProfileSel').value='';check('hidden selector is not status authority',getCalibrationStatus().back.status==='Measured');
    const method=$('#setting-duplexMethod');method.value='auto';method.dispatchEvent(new Event('change',{bubbles:true}));
    status=getCalibrationStatus();check('different feed keeps front measurement and clears unused back correction',status.front.status==='Measured'&&status.back.status==='Uncalibrated');
    check('different feed does not retain drift',S.settings.backOffsetX===0&&S.settings.backOffsetY===0);
    const method2=$('#setting-duplexMethod');method2.value='manual';method2.dispatchEvent(new Event('change',{bubbles:true}));
    check('return to measured duplex resolves its stored values',S.settings.backOffsetX===2&&S.settings.backOffsetY===3);
    const orientation=$('#paperForm [data-k=orientation]');orientation.value='portrait';orientation.dispatchEvent(new Event('change',{bubbles:true}));
    check('orientation resolves duplex before turning',S.settings.backOffsetX===-3&&S.settings.backOffsetY===2);
    check('turned values are estimated',getCalibrationStatus().back.status==='Estimated');
    const before=printJobKey();renderAlignmentOverlay();
    check('alignment overlay has physical front and back outlines',$$('#alignmentOverlay polygon').length===2);
    check('alignment overlay changes no print inputs',printJobKey()===before);
    return fails.length?{failed:fails}:true;
  } finally {Object.assign(S,original);save();renderAll();}
})();
