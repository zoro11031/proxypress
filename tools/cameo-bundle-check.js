// Exercises the production PDF and ZIP writers with local artwork and Studio templates.
// Pass an output directory to retain the ZIPs and PDFs for visual inspection.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {inflateSync} = require('node:zlib');
const DARK_CARD = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNgYGAAAAAEAAH2FzhVAAAAAElFTkSuQmCC';
const root = path.join(__dirname,'..');
const html = fs.readFileSync(path.join(root,'proxy-press.html'),'utf8');
const slice = (from,to) => html.slice(html.indexOf(from),html.indexOf(to));
const functions = ['printSourceBleed','scmArtworkPlacement','scmTemplateFor','scmSettings','preferredScmSettings','scmSkipPositions','scmLayout','layout','slotPos','turnAngle','turnPt','backTurn','faceRot','makeT',
  'registrationFrame','regArm','regArmCap','regMarks','regInkBoxes','regMarksClipped','regConflict','regContacts',
  'newDoc','pdfLines','runPreflight','exportSheetIndex','exportPrintJob','cameoPaperLayout','studioCanvasPad','activeGuides','guideLines','cardCornerColor',
  'cutterCardRect','cutterTurn','cutSheetCards','cutSvg','cutDxf','studioCutBounds','studioBoundsText','buildCameoBundle',
  'applyCameoLayout','applyRotaryLayout','bestCutBleed'];
const code = functions.map(name=>{
  const start = new RegExp(`^(?:async )?function ${name}\\(`,'m').exec(html).index;
  return html.slice(start,html.indexOf('\n}',start)+2);
}).join('\n');
const calibration = {front:{status:'Manual'},hasBacks:false};
const outputs = [], notices = [], scope = {value:'all'}, state = {activeSheet:0};
const unavailable = new Set();
const renderedFaces = [];
const context = vm.createContext({console, TextEncoder, Blob, calibration,
  $:sel=>sel==='#exportScope' ? scope : {closest:()=>null,classList:{contains:()=>true}}, S:state,
  window:{jspdf:require('../assets/vendor/jspdf.umd.min.js')},
  fetch:async url=>unavailable.has(url) ? new Response('',{status:404}) : new Response(fs.readFileSync(path.join(root,url))),
  serverPath:url=>url, sheetFeedable:()=>true, isPreview:()=>false,
  sourceCornerLum:new Map(), inspectPrintArtwork:async()=>({ok:true,width:2400,height:3200}),
  artworkKey:face=>face.name, renderFace:async(face,dpi,hi,rotation,settings,back)=>{
    renderedFaces.push({rotation,back});
    return {toDataURL:()=> 'data:image/png;base64,' + DARK_CARD};
  },
  printJobKey:()=> 'job', reviewKey:()=>`${scope.value}/${state.exportSheet ?? state.activeSheet}`,
  imgCache:new Map(), latestPrintReview:null, renderGuideTab:()=>{}, switchTab:()=>{},
  busy:()=>{}, busyProgress:()=>{}, sleep:async()=>{}, showPostExportInstructions:()=>{},
  resolveAppliedCalibration:()=>{}, setShowCuts:()=>{}, save:()=>{}, renderAll:()=>{}, printerOf:()=>({kind:'Laser'}),
  toast:message=>notices.push(message), download:(blob,name)=>outputs.push({blob,name})});
vm.runInContext(code + '\n' + slice('const PAGE_SIZES =','const BUILTIN_PRESETS =') + '\n'
  + slice('const SCM_TEMPLATES =','function scmTemplateFor') + '\n'
  + slice('const GUIDE_EDGE','function activeGuides') + '\n'
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
    ['letter','landscape',8,{},false,false], ['letter','landscape',4,{cols:2,rows:2},false,false], ['letter','portrait',9,{},false,false],
    ['a4','landscape',8,{},false,false], ['a4','portrait',9,{},false,false],
    ['letter','landscape',10,{},true,false], ['letter','landscape',10,{},true,true],
    ['letter','landscape',8,correction,true,false],
    ['letter','landscape',8,{regOrientation:'portrait',...correction},false,false],
    ['letter','landscape',8,{offsetY:-11},false,false],
    ['letter','landscape',8,{offsetX:-1,offsetY:1.1},false,false],
    ['letter','landscape',8,{offsetX:-1,offsetY:1.1,regLen:8},false,false],
    ['letter','landscape',8,{regInset:3.5},false,false],
    ['letter','landscape',8,{regInset:0},false,false]
  ];
  let fourCardJob;
  for (const [paper,orientation,count,overrides,duplex,current] of cases) {
    Object.assign(context,{paper,orientation,count,overrides,duplex});
    scope.value = current ? 'current' : 'all'; state.activeSheet = 0; state.exportSheet = current ? 1 : null;
    const name = `${paper}-${orientation}-${count}${current ? '-current' : ''}${overrides.regOrientation ? '-turned' : ''}${overrides.printRotate ? '-corrected' : ''}${overrides.offsetY === -11 ? '-11mm-up' : ''}${overrides.regInset === 3.5 ? '-3.5mm-inset' : ''}${overrides.offsetY === 1.1 ? '-tight-bleed' : ''}`;
    const job = vm.runInContext(`(() => {
      const settings = {...DEFAULTS,...cameoPaperLayout(orientation),pageSize:paper,silhouette:true,guides:'none',...overrides};
      const L = layout(settings), slots = Array.from({length:count},(_,i)=>({front:{name:'Front '+i,custom:'art'},back:duplex?{name:'Back',custom:'back'}:null}));
      const sheets = []; for (let i=0; i<slots.length; i+=L.per) sheets.push({index:sheets.length,slots:slots.slice(i,i+L.per)});
      return {key:'job',settings,layout:L,slots,sheets,hasBacks:duplex,calibration,project:{name:'Test cards'}};
    })()`,context);
    if (paper==='letter' && orientation==='landscape' && count===4) fourCardJob = job;
    const prev = outputs.length;
    await vm.runInContext('exportPrintJob',context)(job,true);
    if (overrides.regInset === 0) {
      assert.equal(outputs.length,prev);
      assert.match(notices.at(-1),/registration marks extend off/);
      continue;
    }
    if (overrides.regLen === 8) {
      assert.equal(outputs.length,prev,'manual arms touching black bleed must be blocked');
      assert.match(notices.at(-1),/Sheet 1: bottom-left L/);
      continue;
    }
    if (overrides.offsetY === -11) {
      assert.equal(outputs.length,prev);
      assert.match(notices.at(-1),/registration marks on Sheet 1: (top-left square|top-right L|bottom-left L)/);
      continue;
    }
    assert.equal(outputs.length,prev+1,`${name}: ${notices.at(-1)}`);
    const data = Buffer.from(await outputs.at(-1).blob.arrayBuffer()), files = readZip(data);
    const info = JSON.parse(files.get('registration.json'));
    assert.equal(info.format,'proxypress-cameo');
    assert.equal(info.version,1);
    const pdf = files.get(info.pdf);
    assert.equal(info.mat.paperOffset,0);
    assert.equal(info.studioCanvas.paperOffset,Math.max(0,10-info.registration.inset));
    const readme = files.get('Read me.txt').toString();
    assert.match(readme,/Silhouette Control Center: align the paper with the top-left/);
    assert.match(readme,/DXF Open to As-is/);
    assert.match(readme,new RegExp(`Page Setup set media to ${info.mat.orientation}`));
    assert.equal(info.studioCanvas.orientation,info.mat.orientation);
    if (overrides.regInset === 3.5) assert.match(readme,/Silhouette Studio: place the paper 6.5 mm in/);
    const selected = current ? job.sheets.slice(1) : job.sheets;
    const pages = pdfPages(pdf), key = `${paper}-${orientation}`;
    if (overrides.printRotate || overrides.offsetY === 1.1) assert.ok(info.registration.armLength < 8.0264);
    assert.equal(info.sheets.length,selected.length,name);
    assert.equal(Number(pdf.toString('latin1').match(/\/Type \/Pages\b[\s\S]*?\/Count (\d+)/)[1]),selected.length*(duplex?2:1));
    for (const [i,sheet] of selected.entries()) {
      const row = info.sheets[i], full = sheet.slots.length === job.layout.per && !overrides.printRotate && overrides.offsetY !== 1.1 && key !== 'letter-portrait';
      const {nearMarks,studioBounds,...mapping} = row;
      assert.ok(studioBounds.width>0 && studioBounds.height>0);
      assert.match(readme,/DXF placement: .* top-left X/);
      if (count === 4) {
        near(studioBounds.width,127.25);
        near(studioBounds.height,177.25);
      }
      assert.ok(Array.isArray(nearMarks));
      assert.ok(nearMarks.every(mark=>['top-left square','top-right L','bottom-left L'].includes(mark)));
      if (overrides.printRotate && !overrides.regOrientation) {
        assert.ok(nearMarks.includes('bottom-left L'),'the corrected dark artwork crowds the bottom-left mark');
        assert.match(readme,/Artwork close to these marks .*bottom-left L/);
      }
      assert.deepEqual(mapping,{sheet:sheet.index+1,frontPage:i*(duplex?2:1)+1,backPage:duplex?i*2+2:null,
        cards:sheet.slots.length,dxf:`sheet-${sheet.index+1}.dxf`,cutFile:`sheet-${sheet.index+1}.${full ? 'studio3' : 'dxf'}`,svg:`sheet-${sheet.index+1}.svg`});
      assert.equal(files.get(row.svg).toString(),vm.runInContext('cutSvg',context)(sheet.index,job));
      assert.equal((files.get(row.svg).toString().match(/<rect /g)||[]).length,row.cards);
      assert.equal((files.get(row.dxf).toString().match(/\nPOLYLINE\n/g)||[]).length,row.cards);
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
        const spec = manifest[count === 4 ? `${key}-4` : key];
        if (count === 4) {
          for (const offsets of [spec.pageOffsets,spec.storedPageOffsets]) {
            near(cut.readFloatLE(offsets[0]),279.4);
            near(cut.readFloatLE(offsets[1]),215.9);
          }
          for (const [n,group] of spec.outlines.entries()) {
            const outline = group.find(o=>o.f);
            const xs = outline.o.map(off=>cut.readFloatLE(off));
            const ys = outline.o.map(off=>-cut.readFloatLE(off+4));
            near(Math.min(...xs)-outline.dx,[76.075,140.325][n%2]);
            near(Math.min(...ys)-outline.dy,[19.325,108.575][Math.floor(n/2)]);
            near(Math.max(...xs)-Math.min(...xs),63);
            near(Math.max(...ys)-Math.min(...ys),88);
          }
          for (const off of [3493,4726,5959,7192]) near(cut.readFloatLE(off),215.8733);
        }
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
  assert.ok(fourCardJob);
  scope.value = 'all';
  unavailable.add('/assets/studio3/letter-standard_double-v3.studio3');
  vm.runInContext("studio3Files.delete('letter-standard_double-v3.studio3')",context);
  assert.equal((await vm.runInContext('studio3AvailableSheets',context)(fourCardJob,fourCardJob.sheets)).length,0);
  await vm.runInContext('exportPrintJob',context)(fourCardJob,true);
  const fallback = readZip(Buffer.from(await outputs.at(-1).blob.arrayBuffer()));
  const row = JSON.parse(fallback.get('registration.json')).sheets[0];
  assert.equal(row.cutFile,'sheet-1.dxf');
  assert.ok(fallback.has('sheet-1.dxf') && fallback.has('sheet-1.svg') && !fallback.has('sheet-1.studio3'));
  unavailable.clear();
  console.log('PASS a missing native asset leaves a usable matched ZIP');
  console.log('PASS clipped registration marks block the matched download');
  console.log('PASS front artwork moved over fixed registration marks blocks export');

  state.settings = {...vm.runInContext('DEFAULTS',context)};
  const switchMode = name => vm.runInContext(`${name}(); layout()`,context);
  assert.equal(switchMode('applyCameoLayout').scm,'letter-standard-v6.studio3');
  assert.equal(state.settings.guides,'none');
  assert.equal(switchMode('applyRotaryLayout').scm,undefined);
  assert.equal(state.settings.silhouette,false);
  assert.equal(state.settings.guides,'both');
  assert.equal(switchMode('applyCameoLayout').scm,'letter-standard-v6.studio3');
  assert.equal(state.settings.guides,'none');
  console.log('PASS mode changes automatically switch between rotary and stock SCM PDFs');

  const templates = vm.runInContext('Object.keys(SCM_TEMPLATES)',context);
  assert.equal(templates.length,190);
  for (const key of templates) {
    const [pageSize,cardPreset,variant] = key.split('/');
    const s = {...vm.runInContext('DEFAULTS',context),pageSize,cardPreset};
    Object.assign(s,vm.runInContext('scmSettings',context)(s,variant));
    const L = vm.runInContext('layout',context)(s);
    const slots = Array.from({length:L.per},(_,i)=>({front:{name:'Card '+i,custom:'art'}}));
    const report = await vm.runInContext('runPreflight',context)({settings:s,layout:L,slots,
      deck:{},calibration,printer:'test',hasBacks:false});
    assert.ok(report.valid,`${key}: ${report.errors.map(issue=>issue.message)}`);
  }
  console.log(`PASS all ${templates.length} stock grids clear preflight with a full sheet`);

  // Independent anchors from SCM's shipped templates and its 300 ppi output.
  const stock = [
    ['letter','standard','letter-standard-v6.studio3',3300,2550,140,228,744,1039,8,10,8.04,0,180],
    ['a4','standard','a4-standard-v5.studio3',3507,2480,244,194,744,1039,8,10,9.4,0,180],
    ['letter','borderless','borderless/letter-standard-borderless-v2.studio3',3300,2550,76,1662,1039,744,9,3.5,7.45,-90,-90],
    ['a4','borderless','borderless/a4-standard-borderless-v2.studio3',3507,2480,180,1627,1039,744,9,3.5,10.5,-90,-90],
    ['arch_b','standard','arch_b-standard-v4.studio3',5400,3600,430,226,744,1039,18,10,20,0,180],
  ];
  const size = 25.4/300, pt = 72/25.4;
  const jsPDF = context.window.jspdf.jsPDF, pdfDownloads = [];
  context.window.jspdf = {jsPDF: function (...args) {
    const doc = new jsPDF(...args);
    doc.save = () => pdfDownloads.push(Buffer.from(doc.output('arraybuffer')));
    return doc;
  }};
  for (const [paper,variant,file,W,H,x,y,cw,ch,per,inset,arm,frontRotation,backRotation] of stock) {
    const settings = vm.runInContext('DEFAULTS',context);
    const s = {...settings,pageSize:paper,...correction};
    Object.assign(s,vm.runInContext('scmSettings',context)(s,variant));
    const L = vm.runInContext('layout',context)(s);
    assert.equal(L.scm,file);
    assert.equal(L.per,per);
    assert.equal(s.guides,'none');
    const layoutFor = vm.runInContext('layout',context);
    const guideLines = vm.runInContext('guideLines',context);
    const stale = {...s,guides:'all'};
    assert.equal(guideLines(L,per,stale).length,0,'stock cut guides stay off');
    for (const other of [{...stale,silhouette:false}, {...stale,scmTemplate:'custom'}]) {
      assert.ok(guideLines(layoutFor(other),1,other).length > 0,'custom and hand-cut guides still render');
    }
    near(s.bleed,0.625);
    near(L.W,W*size);
    near(L.H,H*size);
    near(s.regLen,arm);
    near(s.regInset,inset);
    const slots = Array.from({length:per},(_,i)=>({front:{name:'Front '+i,custom:'art'},back:{name:'Back '+i,custom:'back'}}));
    const job = {key:'job',settings:s,layout:L,slots,sheets:[{index:0,slots}],hasBacks:true,calibration,project:{name:'SCM test'}};
    const preflight = vm.runInContext('runPreflight',context);
    const options = {deck:job.project,layout:L,slots,calibration,printer:'test',hasBacks:true};
    const staleReport = await preflight({...options,settings:stale});
    assert.ok(!staleReport.warnings.some(issue=>issue.type === 'guides_cameo'),'stock guide warnings match the printed sheet');
    const custom = {...stale,scmTemplate:'custom'};
    const customReport = await preflight({...options,settings:custom,layout:layoutFor(custom)});
    assert.ok(customReport.warnings.some(issue=>issue.type === 'guides_cameo'),'custom guides still warn in Cameo mode');
    const prev = outputs.length;
    renderedFaces.length = 0;
    await vm.runInContext('exportPrintJob',context)(job,true);
    assert.equal(outputs.length,prev+1,`${file}: ${notices.at(-1)}`);
    for (const [back, rotation] of [[false,frontRotation],[true,backRotation]]) {
      const side = renderedFaces.filter(face=>face.back === back);
      assert.equal(side.length,per,`${file}: rendered face count`);
      assert.ok(side.every(face=>face.rotation === rotation),`${file}: ${back ? 'back' : 'front'} artwork must render at ${rotation}°`);
    }
    const data = Buffer.from(await outputs.at(-1).blob.arrayBuffer()), files = readZip(data);
    const info = JSON.parse(files.get('registration.json'));
    const expectedStudio = fs.readFileSync(path.join(root,'assets/studio3',file));
    assert.deepEqual(files.get('sheet-1.studio3'),expectedStudio,`${file}: ZIP uses the original stock document`);
    assert.equal(info.sheets[0].cutFile,'sheet-1.studio3');
    assert.deepEqual(Buffer.from(await vm.runInContext('cutStudio3',context)(0,job)),expectedStudio);
    const pdf = files.get(info.pdf), [front,back] = pdfPages(pdf);
    const pdfSizes = [...pdf.toString('latin1').matchAll(/\/MediaBox\s+\[0 0 (\S+) (\S+)\]/g)];
    assert.equal(pdfSizes.length,2);
    for (const [,width,height] of pdfSizes) assert.deepEqual([+width,+height],[W*72/300,H*72/300]);
    await vm.runInContext('exportPrintJob',context)(job,false);
    assert.deepEqual(pdfPages(pdfDownloads.pop()),[front,back]);
    await vm.runInContext('exportPrintJob',context)({...job,settings:stale},false);
    assert.deepEqual(pdfPages(pdfDownloads.pop()),[front,back],'a stale guide setting cannot change the stock PDF');
    const image = page => page.match(/^(.+) cm$/m)[1].split(' ').map(Number);
    const [w,,,h,left,bottom] = image(front);
    const [,,,backH,,backBottom] = image(back);
    near(w/pt,cw*size+1.25);
    near(h/pt,ch*size+1.25);
    near(left/pt+0.625,x*size);
    near(L.H-(bottom+h)/pt+0.625,y*size);
    assert.equal((front.match(/ re\n/g)||[]).length,5);
    assert.equal((back.match(/ re\n/g)||[]).length,5);
    for (const page of [front,back]) assert.doesNotMatch(page,/^BT$/m,`${file}: blank labels should print no text`);
    assert.ok(Math.abs(backBottom-bottom)>backH/2,'the first back belongs to the mirrored row');
    if (process.argv[2]) {
      fs.writeFileSync(path.join(process.argv[2],`scm-${paper}-${variant}.zip`),data);
      fs.writeFileSync(path.join(process.argv[2],`scm-${paper}-${variant}.pdf`),pdf);
    }
    console.log('PASS stock SCM PDF and duplex:',file);
  }

  const skipSettings = {...vm.runInContext('DEFAULTS',context),scmSkip:'5, 1, 5',scmLabel:'Registration trial'};
  Object.assign(skipSettings,vm.runInContext('scmSettings',context)(skipSettings,'standard'));
  const layout = vm.runInContext('layout',context), slotPos = vm.runInContext('slotPos',context);
  const original = layout({...skipSettings,scmSkip:''}), L = layout(skipSettings);
  assert.equal(L.per,6);
  for (const back of [false,true]) assert.deepEqual(slotPos(L,0,back,skipSettings),slotPos(original,1,back,skipSettings));
  const slots = Array.from({length:7},(_,i)=>({front:{name:'Front '+i,custom:'art'},back:{name:'Back '+i,custom:'back'}}));
  const pages = [{index:0,slots:slots.slice(0,6)}, {index:1,slots:slots.slice(6)}];
  const skippedJob = {key:'job',settings:skipSettings,layout:L,slots,sheets:pages,hasBacks:true,calibration,project:{name:'SCM skipped spots'}};
  const before = outputs.length;
  await vm.runInContext('exportPrintJob',context)(skippedJob,true);
  assert.equal(outputs.length,before+1);
  const skipZip = Buffer.from(await outputs.at(-1).blob.arrayBuffer());
  const files = readZip(skipZip), info = JSON.parse(files.get('registration.json'));
  assert.deepEqual(info.sheets.map(row=>row.cards),[6,1]);
  assert.equal((files.get('sheet-1.svg').toString().match(/<rect /g)||[]).length,6);
  assert.equal((files.get('sheet-2.svg').toString().match(/<rect /g)||[]).length,1);
  const printed = pdfPages(files.get(info.pdf));
  assert.equal(printed.length,4);
  for (let i = 0; i < printed.length; i++) {
    if (i % 2 === 0) assert.deepEqual(printed[i].match(/^.* Tj$/gm),['(Registration trial) Tj']);
    else assert.doesNotMatch(printed[i],/^BT$/m);
  }
  const firstSvg = files.get('sheet-1.svg').toString().match(/<rect x="([\d.]+)"/);
  near(+firstSvg[1],slotPos(original,1,false,skipSettings).x+0.625);
  const allSkipped = {...skipSettings,scmSkip:'1,2,3,4,5,6,7,8'};
  const report = await vm.runInContext('runPreflight',context)({settings:allSkipped,
    layout:layout(allSkipped),slots,deck:{},calibration,printer:'test',hasBacks:true});
  assert.ok(report.errors.some(issue=>issue.type === 'scm_skip_all'));
  if (process.argv[2]) {
    fs.writeFileSync(path.join(process.argv[2],'scm-skipped.zip'),skipZip);
    fs.writeFileSync(path.join(process.argv[2],'scm-skipped.pdf'),files.get(info.pdf));
  }
  console.log('PASS skipped positions match PDF fronts, backs, and cut lines across sheets');

  const fit = vm.runInContext('scmArtworkPlacement',context);
  assert.equal(skipSettings.scmFit,'crop');
  assert.equal(skipSettings.scmFitBack,'same');
  const sourceBleed = vm.runInContext('printSourceBleed',context);
  near(sourceBleed({custom:'art'},skipSettings,true),0);
  near(sourceBleed({custom:'art',srcBleed:3},skipSettings),3);
  const crop = fit(1000,1000,skipSettings,0,false);
  assert.deepEqual(fit(1000,1000,skipSettings,0,true),crop);
  const stretch = fit(1000,1000,{...skipSettings,scmFit:'stretch'},0,false);
  near(stretch.ex,0); near(stretch.ey,0);
  near(crop.ex,0.625); near(crop.ey,0);
  near(crop.src[2]/crop.src[3],crop.dst[2]/crop.dst[3]);
  assert.deepEqual(fit(1000,1000,{...skipSettings,scmFitBack:'stretch'},0,true),stretch);
  const frontCrop = fit(1000,1000,{...skipSettings,scmFit:'stretch',scmCrop:2},0,false);
  assert.ok(frontCrop.src[2]<stretch.src[2] && frontCrop.src[3]<stretch.src[3]);
  console.log('PASS proportional defaults, optional stretch, and real bleed per axis');
})().catch(error=>{console.error(error);process.exitCode=1;});
