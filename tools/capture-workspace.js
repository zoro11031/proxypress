#!/usr/bin/env node
// Development-only rendered evidence; downloads four Scryfall previews into out/.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const arg=(name,fallback)=>{const index=process.argv.indexOf(name);return index<0?fallback:process.argv[index+1];};
(async()=>{
  const directory=path.resolve(root,'out/overhaul-review'),cache=path.join(directory,'visual-art.json');fs.mkdirSync(directory,{recursive:true});
  let images;
  if(fs.existsSync(cache))images=JSON.parse(fs.readFileSync(cache,'utf8'));
  else{
    images=[];
    for(const name of ['Llanowar Elves','Sol Ring','Delver of Secrets','Lightning Bolt']){
      const response=await fetch('https://api.scryfall.com/cards/named?exact='+encodeURIComponent(name),{headers:{'User-Agent':'ProxyPress rendered verification','Accept':'application/json'}});if(!response.ok)throw Error('Scryfall metadata: '+response.status);
      const card=await response.json(),uri=(card.image_uris||card.card_faces[0].image_uris).normal;
      const art=await fetch(uri);if(!art.ok)throw Error('Artwork: '+art.status);images.push({name,src:'data:image/jpeg;base64,'+Buffer.from(await art.arrayBuffer()).toString('base64')});
      await new Promise(resolve=>setTimeout(resolve,150));
    }
    fs.writeFileSync(cache,JSON.stringify(images));
  }
  const state=arg('--state','proof'),baseline=arg('--baseline'),width=arg('--width','1440'),height=arg('--height','900');
  let action='';
  if(state==='empty')action="deck().entries=[];renderAll();setWorkspaceView('cards');await drawPreview();";
  else if(state==='blocked')action="deck().entries[0].faces[0].custom='missing-for-visual-review';renderAll();await drawPreview();$('#btnReviewExport').click();await sleep(500);";
  else if(state==='loading')action="previewUrl=()=>new Promise(()=>{});renderPreview();await sleep(150);";
  else if(state==='calibration')action="S.mode='print';S.calibrationProfileId=null;deck().calibrationState={};deck().entries[0].faces.push({...faces[1],name:'Reverse face'});S.settings.dfcMode='duplex';applyMode();renderAll();openSetupGroup('calibration');for(const [key,value] of [['offsetX',1.2],['offsetY',-.7],['backOffsetX',2.25],['backOffsetY',-3.5]]){const field=document.querySelector('#calForm [data-k='+key+']');field.value=value;field.dispatchEvent(new Event('input',{bubbles:true}));}await drawPreview();await sleep(150);";
  else if(state==='setup')action="S.mode='print';applyMode();S.calibrationProfiles=Array.from({length:4},(_,i)=>({id:'visual-profile-'+i,name:'Cardstock calibration profile '+i+' with a long printer model name, manual feed and short-edge duplex',printer:S.printer,settings:{}}));renderAll();openSetupGroup('calibration');await sleep(150);for(const details of document.querySelectorAll('#workspaceInspector details'))details.open=true;document.querySelector('#setupGroup-calibration').scrollIntoView({block:'start'});";
  else if(state==='order')action="S.mode='order';applyMode();renderAll();setWorkspaceView('proof');await drawPreview();";
  else if(state==='foil')action='await openFoilToneModal();';
  else if(state==='art')action="mpcApi=async()=>({results:[],data:[]});mpcSearch=async()=>new Map();mpcCards=async()=>[];sf=async()=>({data:[]});localIndex.push({file:new File([await store.get('images',faces[1].custom)],'Sol Ring.png',{type:'image/jpeg'}),key:normName('Sol Ring'),words:new Set(['sol','ring'])});await openMpcPicker({e:deck().entries[1],i:0,copies:[{uid:deck().entries[1].uid,copies:[0]}],defaultTab:'local'});await sleep(300);$('#localArt figure')?.click();";
  else if(state!=='proof')throw Error('Unknown capture state');
  const source=`(async()=>{S.welcomed=true;closeModal(true);const images=${JSON.stringify(images)},faces=[];for(const image of images){const key=await storeImage(await(await fetch(image.src)).blob());faces.push({name:image.name,custom:key});}deck().name='Commander workshop';deck().entries=Array.from({length:13},(_,i)=>({uid:uid(),name:i===0?'Llanowar Elves':i===2?'A Very Long Legendary Creature Name to Check Queue Truncation':faces[i%faces.length].name,qty:i===0?100:1,faces:[faces[i%faces.length]]}));S.settings=cleanSettings({...DEFAULTS,pageSize:'letter',orientation:'landscape',cols:4,rows:2,backs:false});S.showBacks=false;S.activeSheet=12;S.zoomMode='fit';renderAll();if(innerWidth<=820){if(typeof setWorkspaceView==='function')setWorkspaceView('proof');else document.body.classList.add('m-preview');}$('#zoomFit').click();await drawPreview();${action}return document.documentElement.scrollWidth<=innerWidth;})();`;
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'pp-visual-')),probe=path.join(temp,'probe.js');fs.writeFileSync(probe,source);
  const output=path.resolve(arg('--output',path.join(directory,'screens',state+'-'+width+'.png')));fs.mkdirSync(path.dirname(output),{recursive:true});
  try{
    const result=spawnSync(process.execPath,[path.join(__dirname,'console-check.js'),'--offline-fixtures','--probe',probe,'--width',width,'--height',height,'--scale',arg('--scale','1'),'--screenshot',output,'--deadline','120'],{cwd:baseline?path.resolve(baseline):root,stdio:'inherit'});
    process.exitCode=result.status??2;
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
