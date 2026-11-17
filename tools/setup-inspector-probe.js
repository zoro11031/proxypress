(async()=>{
 const original=structuredClone(S),printer=printerOf(S.printer),oldName=printer.name,Real=window.jspdf.jsPDF,failed=[],pdfs=[];
 const check=(name,value)=>{if(!value)failed.push(name);};
 try{
  S.welcomed=true;closeModal(true);S.mode='print';applyMode();const c=document.createElement('canvas');c.width=630;c.height=880;const key=await storeImage(await new Promise(r=>c.toBlob(r)));
  deck().entries=[{uid:uid(),name:'Inspector fixture',qty:20,faces:[{name:'Front',custom:key},{name:'Back',custom:key}]}];S.settings=cleanSettings({...DEFAULTS,pageSize:'letter',orientation:'landscape',cols:4,rows:2,backs:false});S.activeSheet=1;S.showBacks=true;renderAll();setWorkspaceView('proof');await drawPreview();
  printer.name='Very long printer model name with duplex tray and cardstock driver settings that must wrap naturally';
  S.calibrationProfiles=Array.from({length:5},(_,i)=>({id:'inspector-profile-'+i,name:'Saved calibration profile '+i+' with a long printer model, heavy cardstock, manual feed and short edge flip',printer:S.printer,settings:{'letter/landscape':{scaleX:100,scaleY:100,offsetX:1,offsetY:2,byDuplex:{'manual/long':{backOffsetX:2,backOffsetY:3,backScaleX:100,backScaleY:100}}}}}));renderPrinter();renderCalibrationProfiles();
  const opener=innerWidth<=820?$('[data-mview=setup]'):$('#workspaceInspector').getClientRects().length?$('#inspPaper'):$('#toggleInspector');opener.focus();opener.click();await sleep(100);
  check('settings opens without changing sheet or side',S.activeSheet===1&&S.showBacks);
  const panel=$('#workspaceInspector');
  for(const group of ['paper','printer','color','calibration']){const details=$('#setupGroup-'+group);if(!details.open){$('summary',details).scrollIntoView({block:'center'});$('summary',details).click();}check(group+' group opens',details.open);}
  $('#workspaceCutDetails').open=true;for(const details of $$('details',panel))details.open=true;await sleep(100);
  check('expanded inspector has no sideways overflow',panel.scrollWidth<=panel.clientWidth+1);
  const profile=$('#calProfileCards [data-cal-profile="inspector-profile-0"]');profile.scrollIntoView({block:'center'});profile.click();await sleep(100);
  check('saved profile uses canonical calibration',S.calibrationProfileId==='inspector-profile-0'&&S.settings.offsetX===1);
  $('#calProfileName').value='Saved profile edited through the full-width inspector';$('#calProfileSave').click();check('profile saves through existing handler',S.calibrationProfiles.some(p=>p.name==='Saved profile edited through the full-width inspector'));
  $('#setupGroup-paper').open=true;$('#customPaperDrawer').open=true;const orientation=$('#paperForm [data-k=orientation]');orientation.value='portrait';orientation.dispatchEvent(new Event('change',{bubbles:true}));await sleep(100);check('orientation changes without losing proof identity',S.settings.orientation==='portrait'&&S.activeSheet===1&&S.showBacks);
  for(const details of $$('details',panel))details.open=true;
  const bounds=panel.getBoundingClientRect();for(const button of $$('button',panel).filter(el=>el.getClientRects().length)){const r=button.getBoundingClientRect();check('button fits inspector width: '+button.textContent.trim().slice(0,35),r.left>=bounds.left+2&&r.right<=bounds.right-2);}
  const last=$$('#calForm input,#calForm select').at(-1);last.scrollIntoView({block:'center'});last.focus();check('last field and focus ring reachable',last.getBoundingClientRect().bottom<$('#workspaceBar').getBoundingClientRect().top-2);
  window.jspdf={...window.jspdf,jsPDF:function(...args){const doc=new Real(...args);doc.save=name=>pdfs.push({name,pages:doc.getNumberOfPages(),pdf:doc.output('datauristring')});return doc;}};
  await $('#btnCal').onclick();await $('#btnDuplexTest').onclick();check('both calibration test PDFs generated',pdfs.length===2&&pdfs.every(pdf=>pdf.pages>0));
  check('profile names wrap in one-column rows',getComputedStyle($('#calProfileCards .pick')).gridTemplateColumns.split(' ').length===1);
  check('test-sheet actions stack',getComputedStyle($('.test-sheets-cluster')).gridTemplateColumns.split(' ').length===1);
  $('#btnCloseSetup').click();await sleep(50);check('close restores keyboard opener',document.activeElement===opener);check('close retains proof sheet and side',S.activeSheet===1&&S.showBacks);
  window.__probeArtifacts={pdfs};return failed.length?{failed}:true;
 }catch(err){return {failed:[...failed,err.stack||err.message]};}finally{printer.name=oldName;window.jspdf={...window.jspdf,jsPDF:Real};closeModal(true);Object.assign(S,original);document.body.classList.remove('settings-open');applyMode();renderAll();}
})();
