// Exercises the production PDF and ZIP writers with local artwork and Studio templates.
// Pass an output directory to retain the ZIPs and PDFs for visual inspection.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname,'..');
const html = fs.readFileSync(path.join(root,'proxy-press.html'),'utf8');
const slice = (from,to) => html.slice(html.indexOf(from),html.indexOf(to));
const functions = ['layout','slotPos','turnAngle','turnPt','backTurn','faceRot','makeT',
  'registrationFrame','regArm','regArmCap','regMarks','regInkBoxes','regMarksClipped','regConflict',
  'newDoc','pdfLines','runPreflight','exportPrintJob','cameoPaperLayout','studioCanvasPad',
  'cutterCardRect','cutSheetCards','cutDxf','buildCameoBundle'];
const code = functions.map(name=>{
  const start = new RegExp(`^(?:async )?function ${name}\\(`,'m').exec(html).index;
  return html.slice(start,html.indexOf('\n}',start)+2);
}).join('\n');
const calibration = {front:{status:'Manual'},hasBacks:false};
const outputs = [], notices = [], scope = {value:'all'}, state = {activeSheet:0};
const context = vm.createContext({console, TextEncoder, Blob, calibration,
  $:sel=>sel==='#exportScope' ? scope : {closest:()=>null,classList:{contains:()=>true}}, S:state,
  window:{jspdf:require('../assets/vendor/jspdf.umd.min.js')},
  fetch:async url=>new Response(fs.readFileSync(path.join(root,url))),
  serverPath:url=>url, sheetFeedable:()=>true, isPreview:()=>false,
  guideLines:()=>[], inspectPrintArtwork:async()=>({ok:true,width:2400,height:3200}),
  artworkKey:face=>face.name, renderFace:async()=>({toDataURL:()=>
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNYu/ckAAROAjQYMQanAAAAAElFTkSuQmCC'}),
  printJobKey:()=> 'job', reviewKey:()=>`${scope.value}/${state.activeSheet}`,
  imgCache:new Map(), latestPrintReview:null, renderGuideTab:()=>{}, switchTab:()=>{},
  busy:()=>{}, busyProgress:()=>{}, sleep:async()=>{}, showPostExportInstructions:()=>{},
  toast:message=>notices.push(message), download:(blob,name)=>outputs.push({blob,name})});
vm.runInContext(code + '\n' + slice('const PAGE_SIZES =','const BUILTIN_PRESETS =') + '\n'
  + slice('const REG_MIN_LEN','function registrationFrame') + '\n'
  + slice('const CRC_TABLE','async function exportMpcZip') + '\n'
  + slice('const DXF_BULGE_90','function cutDxf'),context);

function readZip(bytes) {
  const files = new Map();
  for (let o = 0; bytes.readUInt32LE(o) === 0x04034b50;) {
    const length = bytes.readUInt32LE(o+18), nameLength = bytes.readUInt16LE(o+26);
    const start = o + 30 + nameLength + bytes.readUInt16LE(o+28);
    files.set(bytes.toString('utf8',o+30,o+30+nameLength),bytes.subarray(start,start+length));
    o = start + length;
  }
  return files;
}

(async()=>{
  const manifest = require('../assets/studio3/manifest.json');
  const cases = [
    ['letter','landscape',8,{},false,false], ['letter','portrait',9,{},false,false],
    ['a4','landscape',8,{},false,false], ['a4','portrait',9,{},false,false],
    ['letter','landscape',10,{},true,false], ['letter','landscape',10,{},true,true],
    ['letter','landscape',8,{regOrientation:'portrait',offsetX:-0.47,offsetY:1.68,printRotate:0.1},false,false],
    ['letter','landscape',8,{offsetY:-11},false,false]
  ];
  for (const [paper,orientation,count,overrides,duplex,current] of cases) {
    Object.assign(context,{paper,orientation,count,overrides,duplex});
    scope.value = current ? 'current' : 'all'; state.activeSheet = current ? 1 : 0;
    const name = `${paper}-${orientation}-${count}${current ? '-current' : ''}${overrides.regOrientation ? '-turned' : ''}`;
    const job = vm.runInContext(`(() => {
      const settings = {...DEFAULTS,...cameoPaperLayout(orientation),pageSize:paper,silhouette:true,guides:'none',...overrides};
      const L = layout(settings), slots = Array.from({length:count},(_,i)=>({front:{name:'Front '+i,custom:'art'},back:duplex?{name:'Back',custom:'back'}:null}));
      const sheets = []; for (let i=0; i<slots.length; i+=L.per) sheets.push({index:sheets.length,slots:slots.slice(i,i+L.per)});
      return {key:'job',settings,layout:L,slots,sheets,hasBacks:duplex,calibration,project:{name:'Test cards'}};
    })()`,context);
    const prev = outputs.length;
    await vm.runInContext('exportPrintJob',context)(job,true);
    if (overrides.offsetY === -11) {
      assert.equal(outputs.length,prev);
      assert.match(notices.at(-1),/registration marks extend off/);
      continue;
    }
    assert.equal(outputs.length,prev+1,`${name}: ${notices.at(-1)}`);
    const data = Buffer.from(await outputs.at(-1).blob.arrayBuffer()), files = readZip(data);
    const info = JSON.parse(files.get('registration.json'));
    const pdf = files.get(info.pdf);
    const selected = current ? job.sheets.slice(1) : job.sheets;
    assert.equal(info.sheets.length,selected.length,name);
    assert.equal(Number(pdf.toString('latin1').match(/\/Type \/Pages\b[\s\S]*?\/Count (\d+)/)[1]),selected.length*(duplex?2:1));
    for (const [i,sheet] of selected.entries()) {
      const row = info.sheets[i], full = sheet.slots.length === job.layout.per && !overrides.regOrientation;
      assert.deepEqual(row,{sheet:sheet.index+1,frontPage:i*(duplex?2:1)+1,backPage:duplex?i*2+2:null,
        cards:sheet.slots.length,cutFile:`sheet-${sheet.index+1}.${full ? 'studio3' : 'dxf'}`});
      const cut = files.get(row.cutFile);
      if (full) {
        const spec = manifest[`${paper}-${orientation}`];
        assert.equal(cut.length,spec.bytes);
        assert.ok(Math.abs(cut.readFloatLE(1137)-info.registration.armLength) < 0.001);
        assert.ok(Math.abs(cut.readFloatLE(1113)-info.studioCanvas.inset) < 0.02);
        assert.ok(Math.abs(cut.readFloatLE(1141)-info.registration.thickness) < 0.02);
      } else assert.equal((cut.toString('ascii').match(/\nPOLYLINE\n/g)||[]).length,row.cards);
    }
    assert.equal(info.pdfPage.frontMarkInk.length,5);
    if (process.argv[2]) {
      fs.mkdirSync(process.argv[2],{recursive:true});
      fs.writeFileSync(path.join(process.argv[2],`${name}.zip`),data);
      fs.writeFileSync(path.join(process.argv[2],`${name}.pdf`),pdf);
    }
    console.log('PASS',name);
  }
  console.log('PASS clipped registration marks block the matched download');
})().catch(error=>{console.error(error);process.exitCode=1;});
