#!/usr/bin/env node
// Exercise the actual unpacked Electron renderer with external sources blocked.
const {spawn}=require('node:child_process');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const profileArg=process.argv.indexOf('--profile');
  const profile=profileArg>=0?path.resolve(process.argv[profileArg+1]):fs.mkdtempSync(path.join(os.tmpdir(),'pp-electron-offline-'));
  fs.mkdirSync(profile,{recursive:true});
  const binary=path.resolve('electron/dist/linux-unpacked/proxypress');
  let app,ws,collision,foreignRequests=0,log='',id=0;
  const pending=new Map();
  const cleanup=()=>{try{ws?.close();app?.kill();collision?.close();}catch{}};
  const watchdog=setTimeout(()=>{console.error('FAIL Electron offline check timed out');cleanup();process.exit(1);},120000);
  try{
    if(process.argv.includes('--collision')){collision=http.createServer((req,res)=>{foreignRequests++;res.writeHead(503);res.end('Foreign service');});await new Promise((resolve,reject)=>{collision.once('error',reject);collision.listen(8642,'127.0.0.1',resolve);});}
    app=spawn(binary,['--headless','--disable-gpu','--remote-debugging-port=9479',`--user-data-dir=${profile}/browser`],{env:{...process.env,XDG_CONFIG_HOME:profile+'/config',XDG_CACHE_HOME:profile+'/cache'},stdio:['ignore','pipe','pipe']});
    app.on('error',err=>{log+=err.message;});for(const channel of [app.stdout,app.stderr])channel.on('data',data=>{log=(log+data).slice(-5000);});
    let page;
    for(let i=0;i<150;i++){try{page=(await (await fetch('http://127.0.0.1:9479/json/list')).json()).find(p=>p.type==='page'&&p.url.startsWith('http://127.0.0.1:'));if(page)break;}catch{}await sleep(100);}
    if(!page)throw Error('Electron renderer did not start: '+log);
    if(new URL(page.url).origin!=='http://127.0.0.1:8642')throw Error('Renderer changed its durable storage origin');
    ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
    ws.onmessage=ev=>{const m=JSON.parse(ev.data);if(m.id&&pending.has(m.id)){const {resolve,reject}=pending.get(m.id);pending.delete(m.id);m.error?reject(Error(JSON.stringify(m.error))):resolve(m.result);}};
    const send=(method,params={})=>new Promise((resolve,reject)=>{const request=++id;pending.set(request,{resolve,reject});ws.send(JSON.stringify({id:request,method,params}));});
    const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result?.value;};
    await send('Network.enable');await send('Network.setBlockedURLs',{urls:['https://*','*://*/sf/*','*://*/mpc/*','*://*/suggest/*','*://*/deck?*']});
    await send('Page.reload',{ignoreCache:true});
    for(let i=0;i<100;i++){if(await evaluate("typeof S !== 'undefined' && !!S.deckId && !!window.jspdf"))break;await sleep(100);}
    if(process.argv.includes('--expect-existing')&&!await evaluate("deck().name==='Offline Electron fixture' && !!deck().entries[0].faces[0].template?.artKey"))throw Error('Existing project was lost when server port changed');
    const checks=await evaluate(`(async()=>{
      S.welcomed=true;closeModal(true);const checks=[];const assert=(name,value)=>{if(!value)throw Error(name);checks.push(name);};
      assert('local jsPDF loads without external requests',!!window.jspdf);
      const manifest=await (await fetch('/assets/studio3/manifest.json')).json();
      for(const spec of Object.values(manifest)){const r=await fetch('/assets/studio3/'+spec.file);assert('installed Studio template '+spec.file,r.ok&&(await r.arrayBuffer()).byteLength===spec.bytes);}
      const assets=await (await fetch('/assets/manifest.json')).json();assert('editable asset manifest available',assets.frames?.length>0&&assets.fonts?.length>0);
      assert('local font bytes available',(await fetch('/assets/fonts/'+encodeURIComponent(assets.fonts[0]))).ok);
      const frame=assets.frames[0], image=frame.files.find(file=>/\.(png|jpe?g)$/i.test(file));
      assert('local editable frame bytes available',!!image&&(await fetch('/assets/frames/'+encodeURIComponent(frame.name)+'/'+encodeURIComponent(image))).ok);
      const canvas=document.createElement('canvas');canvas.width=630;canvas.height=880;canvas.getContext('2d').fillRect(0,0,630,880);
      const key=await storeImage(await new Promise(r=>canvas.toBlob(r)));
      deck().name='Offline Electron fixture';deck().entries=[{uid:uid(),name:'Local editable card',qty:1,faces:[{name:'Front',custom:key,template:{name:'Local editable card',artKey:key,style:'modern',text:'Editable source survives.'}}]}];
      S.settings=cleanSettings({...DEFAULTS,pageSize:'letter',orientation:'landscape',cols:4,rows:2,backs:false});S.showBacks=false;
      const pack=await makePrintDeck();assert('compact file contains editable layers',!!pack.images[pack.deck.entries[0].faces[0].template.artKey]);
      await importPrintDeck(pack,false);closeModal(true);
      assert('offline compact file restores artwork',!!await store.get('images',deck().entries[0].faces[0].custom));
      const Real=window.jspdf.jsPDF;let pages=0;
      window.jspdf={...window.jspdf,jsPDF:function(...args){const doc=new Real(...args);doc.save=()=>{pages=doc.getNumberOfPages();};return doc;}};
      await exportPDF(true);assert('offline renderer exports PDF',pages===1);
      const studio=await cutStudio3(0);assert('offline renderer exports fixed-length Studio file',studio.byteLength===manifest['letter-landscape'].bytes);
      assert('offline renderer exports DXF and SVG',cutDxf(0).includes('POLYLINE')&&cutSvg(0).includes('<svg'));
      save();await sleep(400);await saveQueue;assert('offline save is durable',$('#saveStatus').textContent==='Saved');
      return checks;
    })()`);
    await send('Page.reload',{ignoreCache:true});
    let reopened=false;for(let i=0;i<100;i++){try{reopened=await evaluate("typeof S !== 'undefined' && !!S.deckId && deck().name==='Offline Electron fixture' && !!deck().entries[0].faces[0].template?.artKey");if(reopened)break;}catch{}await sleep(100);}
    if(!reopened)throw Error('Offline project did not reopen with edit sources');
    for(const check of checks)console.log('PASS '+check);console.log('PASS Electron reload retains local project and edit sources');
    if(collision){if(foreignRequests)throw Error('Renderer reached the foreign service on port 8642');console.log('PASS occupied port preserves storage origin and never contacts foreign service');}
    if(process.argv.includes('--expect-existing'))console.log('PASS existing project survives desktop restart with port collision');
  }catch(err){console.error('FAIL '+err.message);process.exitCode=1;}
  finally{clearTimeout(watchdog);cleanup();}
})();
