// Exercises the production PDF and ZIP writers with local artwork and Studio templates.
// Pass an output directory to retain the ZIPs and PDFs for visual inspection.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {inflateSync} = require('node:zlib');
const root = path.join(__dirname,'..');
const html = fs.readFileSync(path.join(root,'proxy-press.html'),'utf8');
const slice = (from,to) => html.slice(html.indexOf(from),html.indexOf(to));
const functions = ['layout','slotPos','turnAngle','turnPt','backTurn','faceRot','makeT',
  'registrationFrame','regArm','regArmCap','regMarks','regInkBoxes','regMarksClipped','regConflict',
  'newDoc','pdfLines','runPreflight','exportPrintJob','cameoPaperLayout','studioCanvasPad',
  'cutterCardRect','cutterTurn','cutSheetCards','cutSvg','cutDxf','buildCameoBundle'];
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

function pdfPages(bytes) {
  const text = bytes.toString('latin1');
  return Array.from(text.matchAll(/\/Contents (\d+) 0 R/g),([,ref])=>{
    const [,stream] = text.match(new RegExp(`\\n${ref} 0 obj[\\s\\S]*?stream\\n([\\s\\S]*?)\\nendstream`));
    return inflateSync(Buffer.from(stream,'latin1')).toString();
  });
}

const near = (a,b,tolerance=0.001)=>assert.ok(Math.abs(a-b)<tolerance,`${a} differs from ${b}`);

(async()=>{
  const manifest = require('../assets/studio3/manifest.json');
  const correction = {offsetX:-0.47,offsetY:1.18,printRotate:-0.28,scaleX:100.15,scaleY:99.85};
  const cases = [
    ['letter','landscape',8,{},false,false], ['letter','portrait',9,{},false,false],
    ['a4','landscape',8,{},false,false], ['a4','portrait',9,{},false,false],
    ['letter','landscape',10,{},true,false], ['letter','landscape',10,{},true,true],
    ['letter','landscape',8,correction,true,false],
    ['letter','landscape',8,{regOrientation:'portrait',...correction},false,false],
    ['letter','landscape',8,{offsetY:-11},false,false],
    ['letter','landscape',8,{regInset:0},false,false]
  ];
  for (const [paper,orientation,count,overrides,duplex,current] of cases) {
    Object.assign(context,{paper,orientation,count,overrides,duplex});
    scope.value = current ? 'current' : 'all'; state.activeSheet = current ? 1 : 0;
    const name = `${paper}-${orientation}-${count}${current ? '-current' : ''}${overrides.regOrientation ? '-turned' : ''}${overrides.printRotate ? '-corrected' : ''}${overrides.offsetY === -11 ? '-11mm-up' : ''}`;
    const job = vm.runInContext(`(() => {
      const settings = {...DEFAULTS,...cameoPaperLayout(orientation),pageSize:paper,silhouette:true,guides:'none',...overrides};
      const L = layout(settings), slots = Array.from({length:count},(_,i)=>({front:{name:'Front '+i,custom:'art'},back:duplex?{name:'Back',custom:'back'}:null}));
      const sheets = []; for (let i=0; i<slots.length; i+=L.per) sheets.push({index:sheets.length,slots:slots.slice(i,i+L.per)});
      return {key:'job',settings,layout:L,slots,sheets,hasBacks:duplex,calibration,project:{name:'Test cards'}};
    })()`,context);
    const prev = outputs.length;
    await vm.runInContext('exportPrintJob',context)(job,true);
    if (overrides.regInset === 0) {
      assert.equal(outputs.length,prev);
      assert.match(notices.at(-1),/registration marks extend off/);
      continue;
    }
    if (overrides.offsetY === -11) {
      assert.equal(outputs.length,prev);
      assert.match(notices.at(-1),/Cards overlap Silhouette Cameo registration marks/);
      continue;
    }
    assert.equal(outputs.length,prev+1,`${name}: ${notices.at(-1)}`);
    const data = Buffer.from(await outputs.at(-1).blob.arrayBuffer()), files = readZip(data);
    const info = JSON.parse(files.get('registration.json'));
    assert.equal(info.format,'proxypress-cameo');
    assert.equal(info.version,1);
    const pdf = files.get(info.pdf);
    const selected = current ? job.sheets.slice(1) : job.sheets;
    const pages = pdfPages(pdf), key = `${paper}-${orientation}`;
    if (overrides.printRotate) assert.ok(info.registration.armLength < 8.0264);
    assert.equal(info.sheets.length,selected.length,name);
    assert.equal(Number(pdf.toString('latin1').match(/\/Type \/Pages\b[\s\S]*?\/Count (\d+)/)[1]),selected.length*(duplex?2:1));
    for (const [i,sheet] of selected.entries()) {
      const row = info.sheets[i], full = sheet.slots.length === job.layout.per && !overrides.printRotate && key !== 'letter-portrait';
      assert.deepEqual(row,{sheet:sheet.index+1,frontPage:i*(duplex?2:1)+1,backPage:duplex?i*2+2:null,
        cards:sheet.slots.length,cutFile:`sheet-${sheet.index+1}.${full ? 'studio3' : 'dxf'}`,svg:`sheet-${sheet.index+1}.svg`});
      assert.equal(files.get(row.svg).toString(),vm.runInContext('cutSvg',context)(sheet.index,job));
      const cut = files.get(row.cutFile);
      const pt = 72/25.4, marks = [], stack = [];
      for (const line of pages[row.frontPage-1].split('\n')) {
        if (line === 'q') stack.push(line);
        if (line === 'Q') stack.pop();
        if (line.endsWith(' re')) {
          assert.equal(stack.length,0,'registration ink is outside artwork transforms');
          const [x,y,w,h] = line.split(' ').map(Number);
          marks.push([x/pt,job.layout.H-y/pt,w/pt,-h/pt]);
        }
      }
      assert.equal(marks.length,5);
      marks.forEach(([x,y,w,h],i)=>{
        const [a,,c] = info.pdfPage.frontMarkInk[i];
        near(x,a.x); near(y,a.y); near(x+w,c.x); near(y+h,c.y);
      });
      if (row.backPage) assert.doesNotMatch(pages[row.backPage-1],/ re\n/);
      if (full) {
        const spec = manifest[`${paper}-${orientation}`];
        assert.equal(cut.length,spec.bytes);
        assert.ok(Math.abs(cut.readFloatLE(1137)-info.registration.armLength) < 0.001);
        assert.ok(Math.abs(cut.readFloatLE(1113)-info.studioCanvas.inset) < 0.02);
        assert.ok(Math.abs(cut.readFloatLE(1141)-info.registration.thickness) < 0.02);
      } else assert.equal((cut.toString('ascii').match(/\nPOLYLINE\n/g)||[]).length,row.cards);
      if (overrides.printRotate) {
        // Use the first printed card's PDF image matrix as the reference for
        // the first trim tangent at the lower right, independently of cut layout.
        const [rotation,image] = Array.from(pages[row.frontPage-1].matchAll(/^(.+) cm$/gm),([,s])=>s.split(' ').map(Number));
        const [a,b,c,d,e,f] = rotation, L = job.layout, s = job.settings;
        const trimX = image[4]+image[0]-(s.bleed+s.cornerRadius)*pt*s.scaleX/100;
        const trimY = image[5]+s.bleed*pt*s.scaleY/100;
        const x = (a*trimX+c*trimY+e)/pt, y = L.H-(b*trimX+d*trimY+f)/pt;
        const svg = vm.runInContext('cutSvg',context)(sheet.index,job);
        const [,sx,sy,sw,sh,rx,ry,angle,cx,cy] = svg.match(/x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)" rx="([^"]+)" ry="([^"]+)" transform="rotate\(([^ ]+) ([^ ]+) ([^)]+)\)"/).map(Number);
        const ux = (overrides.regOrientation ? sx : sx+sw-rx)-cx;
        const uy = (overrides.regOrientation ? sy+sh-ry : sy+sh)-cy;
        const cos = Math.cos(angle*Math.PI/180), sin = Math.sin(angle*Math.PI/180);
        near(cx+ux*cos-uy*sin,overrides.regOrientation ? L.H-y : x,0.002);
        near(cy+ux*sin+uy*cos,overrides.regOrientation ? x : y,0.002);
        if (full) {
          const outline = manifest[key].outlines[0].find(o=>!o.r);
          assert.ok(outline);
          near(cut.readFloatLE(outline.o[0]),x,0.05);
          near(cut.readFloatLE(outline.o[0]+4)*(outline.f?-1:1),y,0.05);
        } else {
          const pairs = [...cut.toString('ascii').matchAll(/\n\s*0\nVERTEX\n\s*8\nCUT\n\s*10\n([^\n]+)\n\s*20\n([^\n]+)/g)];
          const [dx,dy] = overrides.regOrientation ? [L.H-y,L.W-x] : [x,L.H-y];
          assert.ok(pairs.slice(0,52).some(([,u,v])=>Math.hypot(+u-dx,+v-dy)<0.001));
        }
      }
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
  console.log('PASS front artwork moved over fixed registration marks blocks export');
})().catch(error=>{console.error(error);process.exitCode=1;});
