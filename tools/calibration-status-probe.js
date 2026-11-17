(async()=>{
 const original=structuredClone(S),Real=window.jspdf.jsPDF,oldConfirm=window.confirm,failed=[],outputs=[];
 const check=(name,value)=>{if(!value)failed.push(name);},near=(a,b)=>Math.abs(a-b)<.00001;
 try{
  S.welcomed=true;closeModal(true);S.mode='print';S.calibrationProfiles=[];S.calibrationProfileId=null;window.confirm=()=>false;applyMode();
  const c=document.createElement('canvas');c.width=630;c.height=880;c.getContext('2d').fillRect(0,0,630,880);const key=await storeImage(await new Promise(r=>c.toBlob(r)));
  deck().entries=[{uid:uid(),name:'Calibration status',qty:1,faces:[{name:'Front',custom:key},{name:'Back',custom:key}]}];deck().calibrationState={};
  S.settings=cleanSettings({...DEFAULTS,pageSize:'letter',orientation:'landscape',cols:4,rows:2,backs:false,dfcMode:'duplex',dpi:100,offsetX:0,offsetY:0,backOffsetX:0,backOffsetY:0,printRotate:0,backRotate:0,scaleX:100,scaleY:100,backScaleX:100,backScaleY:100});renderAll();openSetupGroup('calibration');
  window.jspdf={...window.jspdf,jsPDF:function(...args){const doc=new Real(...args),images=[],add=doc.addImage.bind(doc);doc.addImage=(data,format,x,y,...rest)=>{images.push({x,y});return add(data,format,x,y,...rest);};doc.save=()=>outputs.push({images,pdf:doc.output('datauristring')});return doc;}};
  $('#exportScope').value='all';await exportPDF(true);check('unmeasured default sides have no correction',getCalibrationStatus().front.label==='No correction set'&&getCalibrationStatus().back.label==='No correction set');
  const enter=(key,value)=>{const input=$('#calForm [data-k="'+key+'"]');input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));};
  enter('offsetX',1.2);enter('offsetY',-.7);enter('backOffsetX',2.25);enter('backOffsetY',-3.5);
  let status=getCalibrationStatus();check('manual front and back confirm immediately without a profile',status.front.label==='Manual alignment applied'&&status.back.label==='Manual alignment applied');
  check('all status surfaces share the same label',$('#inspCal').textContent===status.label&&$('#proofCalBadge').textContent===status.label&&$('#guideJobSummary').textContent.includes(status.label));
  check('review uses active values',$('#guideJobSummary').textContent.includes(status.values));await exportPDF(true);
  const [base,manual]=outputs;check('PDF front uses exact entered offsets',base&&manual&&near(manual.images[0].x-base.images[0].x,1.2)&&near(manual.images[0].y-base.images[0].y,-.7));
  check('PDF back uses front plus exact extra offsets',base&&manual&&near(manual.images[1].x-base.images[1].x,3.45)&&near(manual.images[1].y-base.images[1].y,-4.2));
  const before=JSON.stringify(S.settings),oldKey=printJobKey();$('#calProfileName').value='Measured current setup';$('#calProfileSave').click();status=getCalibrationStatus();check('saving immediately reports both recorded measurements',status.front.label==='Measured for this setup'&&status.back.label==='Measured for this setup');
  check('source-only change invalidates review with identical geometry',before===JSON.stringify(S.settings)&&oldKey!==printJobKey()&&$('#proofCalBadge').textContent===status.label);
  const method=$('#setting-duplexFlip');method.value=method.value==='long'?'short':'long';method.dispatchEvent(new Event('change',{bubbles:true}));status=getCalibrationStatus();check('flip preserves front measurement but clears unmeasured back',status.front.status==='Measured'&&status.back.label==='No correction set');
  const orientation=$('#paperForm [data-k=orientation]');orientation.value='portrait';orientation.dispatchEvent(new Event('change',{bubbles:true}));status=getCalibrationStatus();check('orientation carries front as estimated',status.front.label==='Estimated alignment');
  S.calibrationProfileId=null;S.settings=cleanSettings({...S.settings,offsetX:0,offsetY:0,backOffsetX:0,backOffsetY:0,printRotate:0,backRotate:0,scaleX:100,scaleY:100,backScaleX:100,backScaleY:100});deck().calibrationState={};renderAll();enter('offsetX',0);enter('backOffsetX',0);check('explicit zeroes are valid manual measurements',getCalibrationStatus().front.status==='Manual'&&getCalibrationStatus().back.status==='Manual');
  openDuplexWizard();$('#duplexWizardX').value='1';$('#duplexWizardY').value='0';$('#duplexWizardApply').click();check('wizard applies back provenance immediately',getCalibrationStatus().back.status==='Manual');$('#duplexWizardZero').click();check('wizard clear removes the back correction',getCalibrationStatus().back.label==='No correction set');closeModal(true);enter('backOffsetX',0);
  const cleaned=cleanDeck(structuredClone(deck()));check('project cleaning preserves zero provenance',getCalibrationStatus(S.settings,cleaned).front.status==='Manual'&&getCalibrationStatus(S.settings,cleaned).back.status==='Manual');
  $('#calProfileName').value='Explicit zero measurement';$('#calProfileSave').click();applyCalProfile(S.calibrationProfiles.find(p=>p.name==='Explicit zero measurement'));check('saved zero measurements remain measured when reapplied',getCalibrationStatus().front.status==='Measured'&&getCalibrationStatus().back.status==='Measured');enter('offsetX',0);enter('backOffsetX',0);
  save();await sleep(500);await saveQueue;await load();check('durable reopen retains active manual zero measurements',getCalibrationStatus().front.status==='Manual'&&getCalibrationStatus().back.status==='Manual');
  deck().entries[0].faces.splice(1);status=getCalibrationStatus();check('simplex main summary omits the back',!status.label.includes('Back:')&&!status.values.includes('Back:'));
  window.__probeArtifacts={outputs};return failed.length?{failed}:true;
 }catch(err){return {failed:[...failed,err.stack||err.message]};}finally{window.confirm=oldConfirm;window.jspdf={...window.jspdf,jsPDF:Real};Object.assign(S,original);closeModal(true);save();applyMode();renderAll();}
})();
