(async () => {
  S.welcomed=true;closeModal(true);
  const canvas=document.createElement('canvas');canvas.width=630;canvas.height=880;
  const c=canvas.getContext('2d');c.fillStyle='#264a42';c.fillRect(0,0,630,880);c.fillStyle='#d2b979';c.fillRect(20,20,590,840);c.fillStyle='#32544b';c.fillRect(40,100,550,450);c.fillStyle='#222';c.font='30px sans-serif';c.fillText('Llanowar Elves',45,65);c.fillText('Local proof fixture',45,610);
  const key='visual-fixture';await store.set('images',key,await new Promise(r=>canvas.toBlob(r)));
  deck().entries=Array.from({length:12},(_,i)=>({uid:'visual-'+i,name:i===2?'A Very Long Legendary Creature Name to Check Queue Truncation':'Commander card '+(i+1),qty:i===0?89:1,faces:[{name:'Front '+i,custom:key}]}));
  S.settings=cleanSettings({...DEFAULTS,pageSize:'letter',orientation:'landscape',cols:4,rows:2,backs:false});
  S.showBacks=false;S.activeSheet=1;renderAll();await drawPreview();
  await new Promise(r=>setTimeout(r,500));closeModal(true);
  $('#zoomFit').click();await drawPreview();
  if(document.documentElement.scrollWidth>innerWidth) return {failed:['Horizontal page overflow']};
  return true;
})();
