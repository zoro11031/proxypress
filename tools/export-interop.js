// Offline geometry exports from the actual application functions. No browser/PDF claim.
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../proxy-press.html'), 'utf8');
const names = ['layout', 'slotPos', 'turnAngle', 'turnPt', 'makeT', 'registrationFrame', 'regArm', 'regArmCap',
  'regMarks', 'studio3Key', 'cutSheetCards', 'cutterCardRect', 'cutSvg'];
const functions = names.map(name => {
  const start = html.indexOf(`function ${name}(`), end = html.indexOf('\n}', start);
  if (start < 0 || end < 0) throw Error(`Missing function ${name}`);
  return html.slice(start, end + 2);
}).join('\n');
const defaults = html.slice(html.indexOf('const DEFAULTS ='), html.indexOf('const BUILTIN_PRESETS ='));
const markConstants = html.slice(html.indexOf('const REG_MIN_LEN'), html.indexOf('function registrationFrame'));
const studioBases = html.slice(html.indexOf('const STUDIO3_BASES'), html.indexOf('const STUDIO3_MARKS_MISMATCH'));
const context = vm.createContext({});
vm.runInContext(defaults + markConstants + studioBases + `\nconst PAGE_SIZES={letter:[215.9,279.4],a4:[210,297]}; const S={settings:{}}; let count=0; function buildSlots(){return Array(count);} function buildPrintJob(){return {settings:S.settings,layout:layout(),slots:buildSlots()};}\n` + functions, context);
const artifacts = vm.runInContext(`(() => { const out=[];
for(const [orientation, per, counts, sets] of [
  ['landscape', 8, [1, 8, 9, 16], {orientation:'landscape', cols:4, rows:2, margin:10, bleed:0.625}],
  ['portrait', 9, [1, 9, 10, 18], {orientation:'portrait', cols:3, rows:3, margin:5, bleed:0.5, regInset:3.5, regLen:0}]
]) for(const paper of ['letter','a4']) for(const n of counts) {
 S.settings={...DEFAULTS,pageSize:paper,cardRotation:'upright',gap:0,silhouette:true,...sets}; count=n;
 const L=layout(); out.push({paper,orientation,count:n,arm:regArm(L),marks:regMarks(L),svgs:Array.from({length:Math.ceil(n/per)},(_,i)=>cutSvg(i))});
}
S.settings={...S.settings,orientation:'landscape',cols:4,rows:2,margin:10,bleed:0.625,regInset:10,scaleX:99,scaleY:101,offsetX:2,offsetY:-3}; count=8;
out.push({paper:'a4',orientation:'landscape',count:8,calibrated:true,svgs:[cutSvg(0)]});
return out; })()`, context);
process.stdout.write(JSON.stringify(artifacts));
