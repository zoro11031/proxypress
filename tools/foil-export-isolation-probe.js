(async () => {
  const saved=structuredClone(S),failed=[];const check=(n,v)=>{if(!v)failed.push(n);};
  try {
    S.welcomed=true;closeModal(true);const c=document.createElement('canvas');c.width=252;c.height=352;const ctx=c.getContext('2d');const g=ctx.createLinearGradient(0,0,252,352);g.addColorStop(0,'#101840');g.addColorStop(1,'#f0d080');ctx.fillStyle=g;ctx.fillRect(0,0,252,352);
    const key=await storeImage(await new Promise(r=>c.toBlob(r))),face={name:'Foil reference fixture',custom:key};deck().entries=[{uid:uid(),name:face.name,qty:1,faces:[face]}];S.settings=cleanSettings({...DEFAULTS,brightness:110,saturation:140,backs:false});
    const before=(await renderFace(face,100,true)).toDataURL(),svg=cutSvg(0),dxf=cutDxf(0),job=printJobKey();
    await openFoilToneModal();
    const mid=$('#simMidtone');mid.value='1.7';mid.dispatchEvent(new Event('input',{bubbles:true}));
    $('#simReflection').checked=true;$('#simReflection').dispatchEvent(new Event('change',{bubbles:true}));
    for(const angle of [-45,0,45]){const tilt=$('#simTilt');tilt.value=String(angle);tilt.dispatchEvent(new Event('input',{bubbles:true}));await sleep(30);check('simulation leaves export pixels identical at tilt '+angle,(await renderFace(face,100,true)).toDataURL()===before);}
    check('foil view leaves job and cut geometry identical',job===printJobKey()&&svg===cutSvg(0)&&dxf===cutDxf(0));
    check('reflection is an optional preview control',!!$('#simReflection')&&!!$('#simTilt'));
    return failed.length?{failed}:true;
  } catch (err) { return {failed:[err.stack || err.message]}; } finally {closeModal(true);Object.assign(S,saved);save();renderAll();}
})();
