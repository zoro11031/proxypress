#!/usr/bin/env node
// Repeatable browser regression set. Each run must prove its own harness listeners.
const {spawn}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path');
const destination=path.resolve(process.argv[2]||'out/overhaul-review/checks');fs.mkdirSync(destination,{recursive:true});
const checks=[
  ['navigation','navigation-probe.js',1440,900],
  ['phone','navigation-probe.js',390,844],
  ['narrow-dialog','narrow-dialog-probe.js',320,740],
  ['snapshot','job-snapshot-probe.js'],
  ['readiness','art-readiness-probe.js'],
  ['imports','staged-import-probe.js'],
  ['order-intake','order-intake-probe.js'],
  ['project-settings','project-settings-probe.js'],
  ['backup-merge','backup-merge-probe.js'],
  ['calibration','calibration-provenance-probe.js'],
  ['registration','occupied-registration-probe.js'],
  ['copy-selection','selection-probe.js'],
  ['face-routing','face-routing-probe.js'],
  ['commander-phone','commander-workflow-probe.js',390,844],
  ['order-snapshot','order-snapshot-probe.js'],
  ['sheet-exports','sheet-export-probe.js'],
  ['cut-exports','cut-sheet-export-probe.js'],
  ['foil-isolation','foil-export-isolation-probe.js'],
  ['cube','cube-performance-probe.js']
];
(async()=>{
  const results=[];
  for(const [name,probe,width=1440,height=900] of checks){
    const args=['tools/console-check.js','--offline-fixtures','--probe','tools/'+probe,'--width',String(width),'--height',String(height),'--deadline','150','--artifacts',path.join(destination,name+'.json')];
    const started=Date.now();let output='';
    const code=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,args,{stdio:['ignore','pipe','pipe']});child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);child.on('error',reject);child.on('close',resolve);});
    const pass=code===0&&output.includes('app loaded: yes')&&output.includes('probe: true')&&output.includes('PASS - page clean');
    fs.writeFileSync(path.join(destination,name+'.log'),output);
    results.push({name,command:[process.execPath,...args],code,pass,elapsedMs:Date.now()-started});fs.writeFileSync(path.join(destination,'results.json'),JSON.stringify(results,null,2));
    console.log((pass?'PASS ':'FAIL ')+name);if(!pass)process.stdout.write(output);
  }
  if(results.some(result=>!result.pass))process.exitCode=1;
})().catch(err=>{console.error(err);process.exitCode=1;});
