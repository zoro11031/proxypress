(async()=>{
 const original=structuredClone(S),oldDownload=download,oldInfo=mpcCardInfo,oldSf=sf,oldApi=mpcApi,oldSearch=mpcSearch,oldCards=mpcCards,failed=[];const check=(name,value)=>{if(!value)failed.push(name);};
 try{
  sf=async()=>({data:[]});mpcApi=async()=>({results:[],data:[]});mpcSearch=async()=>new Map();mpcCards=async()=>[];
  S.welcomed=true;closeModal(true);S.mode='order';S.settings=cleanSettings({...DEFAULTS,backImage:null,backs:false});S.mpc={...MPC_DEFAULTS};S.orderShowBacks=false;applyMode();
  const canvas=document.createElement('canvas');canvas.width=630;canvas.height=880;const ctx=canvas.getContext('2d');ctx.fillStyle='#355849';ctx.fillRect(0,0,630,880);const key=await storeImage(await new Promise(r=>canvas.toBlob(r)));ctx.fillStyle='#c7a14f';ctx.fillRect(0,0,630,880);const back=await storeImage(await new Promise(r=>canvas.toBlob(r)));
  deck().entries=[];deck().cardback=null;renderAll();setWorkspaceView('proof');await drawPreview();check('empty order has no cardback prompt',!$('.order-back-prompt')&&!!$('#pages').textContent.includes('start your order'));
  const entry={uid:uid(),qty:1,name:'A long single-faced card name that must remain accessible',set:'TST',cn:'123',faces:[{name:'Front',custom:key}]};deck().entries=[entry];renderAll();await drawPreview();
  check('one prompt and singular affected count',$$('.order-back-prompt').length===1&&$('.order-back-prompt').textContent.includes('1 copy needs'));
  check('shared back is absent from per-card attention',getPrintJobIssues().length===0&&!$('#cardList [data-act=fix-issue]'));
  const frontTile=$('.gal .tile').getBoundingClientRect();check('small order tile stays card sized',frontTile.width<=241&&frontTile.width>80);
  $('.gal-cb').click();check('prompt opens existing picker directly',!!$('#cmpGrid')&&!$('#oStock').closest('#modal'));closeModal(true);
  await $('#fileOrderBack').onchange({target:{files:[new File([await store.get('images',back)],'Shared back.png',{type:'image/png'})],value:''}});await drawPreview();check('chosen back has thumbnail and action',!!$('.order-back-prompt img')&&$('.gal-cb').textContent==='Change cardback');
  const img=$('.gal img');img.focus();img.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));check('keyboard selects a physical copy',selectedCopies.has(copyKey(entry,0)));
  $('[data-order-side=back]').click();await drawPreview();check('back view keeps one equal-sized tile',$$('.gal .tile').length===1&&Math.abs($('.gal .tile').getBoundingClientRect().width-frontTile.width)<1&&$('.gal img').dataset.face==='back');check('side change retains selection',selectedCopies.has(copyKey(entry,0)));
  $('.order-back-clear').click();await sleep(100);await drawPreview();check('clearing restores exactly one prompt',$$('.order-back-prompt').length===1&&$('.gal-cb').textContent==='Choose a cardback');
  const double={uid:uid(),qty:1,name:'Double-faced fixture',faces:[{name:'DFC front',custom:key},{name:'DFC back'}]};entry.qty=2;deck().entries.push(double);renderAll();await drawPreview();
  check('mixed order counts only shared copies',$('.order-back-prompt').textContent.includes('2 copies need'));
  check('genuine DFC back issue stays on its row',getPrintJobIssues().some(i=>i.uid===double.uid&&i.faceIdx===1)&&!getPrintJobIssues().some(i=>i.uid===entry.uid));
  const fix=$(`#cardList [data-uid="${double.uid}"] [data-act=fix-issue]`);fix.click();await sleep(50);check('DFC warning opens correct face',$('#modal .hd').textContent.includes('Back'));closeModal(true);
  double.faces[1].custom=back;deck().entries=[double];renderAll();await drawPreview();check('all individual backs omit shared prompt',!$('.order-back-prompt'));
  entry.qty=100;deck().entries=[entry,double];deck().cardback={name:'Shared back',custom:back};renderAll();await drawPreview();
  check('large gallery preserves physical copies',$$('.gal .tile').length===101);
  check('gallery uses available width',$('.order-gallery').getBoundingClientRect().width>=$('#pages').clientWidth-20);
  if(innerWidth>=1024)check('desktop gallery fills multiple columns',new Set($$('.gal .tile').slice(0,8).map(el=>Math.round(el.getBoundingClientRect().left))).size>=3);
  const tiles=$$('.gal .tile').map(el=>el.getBoundingClientRect());check('tiles have consistent width',tiles.every(t=>Math.abs(t.width-tiles[0].width)<1));check('partial final row starts on grid',Math.abs(tiles.find(t=>Math.abs(t.top-tiles.at(-1).top)<1).left-tiles[0].left)<1);check('no document overflow',document.documentElement.scrollWidth<=innerWidth);
  switchTab('order');check('ZIP action label',$('#oZip').textContent==='Download full order (ZIP)');$('#oZip').click();check('ZIP review reports stock and finish',$('#modal').textContent.includes('Non-foil')&&$('#modal').textContent.includes('101 cards will be exported'));
  const zipDownloads=[];download=(blob,name)=>zipDownloads.push({blob,name});mpcCardInfo=async()=>f=>({file:f.file,query:f.name});S.mpc.stock='(P10) Plastic';S.mpc.foil=true;$('#orderReviewExport').click();for(let i=0;i<200&&!zipDownloads.length;i++)await sleep(10);check('ZIP review generates a download',zipDownloads.length===1);
  if(zipDownloads.length){const bytes=new Uint8Array(await zipDownloads[0].blob.arrayBuffer()),view=new DataView(bytes.buffer),decoder=new TextDecoder();let offset=0,xml='';while(view.getUint32(offset,true)===0x04034b50){const length=view.getUint32(offset+18,true),nameLength=view.getUint16(offset+26,true),extra=view.getUint16(offset+28,true),start=offset+30,name=decoder.decode(bytes.slice(start,start+nameLength)),data=start+nameLength+extra;if(name.endsWith('.xml'))xml=decoder.decode(bytes.slice(data,data+length));offset=data+length;}check('ZIP retains reviewed stock, finish and copies',xml.includes('<quantity>101</quantity>')&&xml.includes('<foil>false</foil>')&&xml.includes('<stock>'+MPC_DEFAULTS.stock+'</stock>'));}
  closeModal(true);S.mpc.stock=MPC_DEFAULTS.stock;S.mpc.foil=false;
  const remote={uid:uid(),qty:3,name:'Online card',faces:[{name:'Online',drive:'online-card-id',normal:canvas.toDataURL(),file:'Online.png'}]};deck().entries.push(remote);renderOrder();switchTab('order');$('#oXml').click();check('XML review reports uploaded-art omissions',$('#modal').textContent.includes('3 cards will be exported')&&$('#modal').textContent.includes('uploaded')&&$('#modal').textContent.includes('shared back'));
  const downloads=[];download=(blob,name)=>downloads.push({blob,name});mpcCardInfo=async()=>f=>({file:f.file,query:f.name});S.mpc.stock='(P10) Plastic';S.mpc.foil=true;deck().entries=[];$('#orderReviewExport').click();await sleep(100);
  check('XML downloads reviewed snapshot',downloads.length===1&&(await downloads[0].blob.text()).includes('<quantity>3</quantity>')&&(await downloads[0].blob.text()).includes('<stock>'+MPC_DEFAULTS.stock+'</stock>'));
  return failed.length?{failed}:true;
 }catch(err){return {failed:[...failed,err.stack||err.message]};}finally{closeModal(true);download=oldDownload;mpcCardInfo=oldInfo;sf=oldSf;mpcApi=oldApi;mpcSearch=oldSearch;mpcCards=oldCards;Object.assign(S,original);applyMode();renderAll();}
})();
