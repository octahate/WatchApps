const assert = require('node:assert/strict');
const fs = require('node:fs');
const cp = require('node:child_process');
const vm = require('node:vm');
const catalog = JSON.parse(fs.readFileSync('apps.json', 'utf8'));
const upstream = JSON.parse(cp.execFileSync('git', ['show', 'd8dff30062ebdb14a727d5340129a68471f069eb:apps.json'], {encoding:'utf8'}));
const removed = ['main-sn80','main-beb79','main-gw32','main-g5','multiclock-sn80','multiclock-g5'];
for (const app of upstream) {
  const current = catalog.find(a => a.id === app.id);
  if (removed.includes(app.id)) {assert.equal(current, undefined); continue;}
  assert(current, `Missing P8/shared app: ${app.id}`);
  const expectedFiles = app.storage.filter(f => !f.supports || f.supports.includes('P8'))
    .filter(f => app.id !== 'main' || !['lcd.js','cst816s.js','cst716.js'].includes(f.name))
    .map(({supports,...file})=>file);
  assert.deepEqual(current.storage, expectedFiles, `P8 install files changed: ${app.id}`);
}
for (const app of catalog) {
  assert.deepEqual(app.supports, ['P8']);
  const names = new Set();
  for (const file of app.storage) {
    assert(!names.has(file.name), `Duplicate install target in ${app.id}: ${file.name}`);
    names.add(file.name);
    assert(!file.supports, 'Install files must already be selected for P8');
    if (file.url) assert(fs.existsSync(`apps/${app.id}/${file.url}`), `Missing file: ${file.url}`);
  }
}
const loaderContext = {Puck:{},Const:{},DEVICEINFO:[],document:{getElementById:()=>({})},appJSON:[...catalog,{id:'other',supports:['G5']}]};
vm.createContext(loaderContext);
vm.runInContext(fs.readFileSync('loader.js','utf8'),loaderContext);
loaderContext.onAppJSONLoaded();
assert.equal(loaderContext.appJSON.length,catalog.length);
assert.equal(loaderContext.DEVICEINFO.length,1);
assert.equal(loaderContext.DEVICEINFO[0].id,'P8');
loaderContext.onFoundDeviceInfo('P8');
assert.throws(()=>loaderContext.onFoundDeviceInfo('G5'),/P8 watches only/);
assert.equal(new Set(catalog.map(a => a.id)).size, catalog.length);
const hello = catalog.find(a => a.id === 'hello');
assert.deepEqual(hello.supports, ['P8']);
for (const item of hello.storage) assert(fs.existsSync(`apps/hello/${item.url}`));
const icon = vm.runInNewContext(fs.readFileSync('apps/hello/app-icon.js', 'utf8'), {atob:s=>Buffer.from(s,'base64')});
assert.equal(icon.length, 3 + 48 * 48 / 8);
assert.deepEqual(Array.from(icon.subarray(0,3)), [48,48,1]);
let touch;
for (const theme of [{fg:0,bg:65535},{fg:65535,bg:0}]) {
  let awake = false;
  let ink = 65535;
  let background = 0;
  let clearedWith;
  const draws = [];
  const g = {theme, getWidth:()=>240, getHeight:()=>240};
  g.reset = () => {ink=65535; background=0; return g;};
  g.setBgColor = value => {background=value; return g;};
  g.clear = () => {clearedWith=background; return g;};
  g.setColor = value => {ink=value; return g;};
  for (const key of ['setFontAlign','setFont','flip']) g[key] = () => g;
  g.drawString = text => {
    assert.notEqual(ink, clearedWith, 'Text must contrast with cleared screen');
    draws.push(text); return g;
  };
  const context = {g, Bangle:{
    setLCDPower:on=>{awake=on;},
    setUI:(mode,cb)=>{assert.equal(mode,'touch');touch=cb;}
  }};
  vm.runInNewContext(fs.readFileSync('apps/hello/app.js','utf8'), context);
  assert(awake, 'App must wake the display');
  assert.equal(clearedWith, theme.bg);
  assert(draws.includes('Hello World!'));
  touch(); assert(draws.includes('Greetings: 1'));
  touch(); assert(draws.includes('Greetings: 2'));
}
// Run the real P8 UI helper: leaving through the button uses its established launcher path.
let button;
let launches = 0;
const TC = {on:()=>{},removeListener:()=>{}};
const wOS = {awake:true,showLauncher:()=>launches++};
vm.runInNewContext(fs.readFileSync('apps/main/setui.js','utf8'), {wOS,TC, BTN1:1,setWatch:cb=>{button=cb;return 1;},clearWatch:()=>{},setTimeout:cb=>cb()});
wOS.setUI('touch',touch); button(); assert.equal(launches,1);
// Verify launcher clears startup text before widgets, including when none are installed.
const events = [];
const lg = {theme:{fg:'#fff',bg:'#000'},getWidth:()=>240,getHeight:()=>240};
for (const key of ['reset','clear','clearRect','setColor','fillCircle','drawCircle']) lg[key]=()=>{events.push(key);return lg;};
const Bangle = {loadWidgets:()=>events.push('loadWidgets'),drawWidgets:()=>events.push('drawWidgets'),setUI:()=>{}};
vm.runInNewContext(fs.readFileSync('apps/launch/launch.js','utf8'), {g:lg,require:()=>({list:()=>[]}), Bangle,TC:{on:()=>{}},global:{}});
assert(events.indexOf('clear') < events.indexOf('loadWidgets'));
assert(events.indexOf('loadWidgets') < events.indexOf('drawWidgets'));
assert(events.indexOf('drawWidgets') < events.indexOf('clearRect'));
assert(fs.existsSync('core/js/index.js'));
assert(fs.existsSync('core/lib/espruinotools.js'));
console.log(`Passed: ${catalog.length} P8/shared apps selected; non-P8 packages excluded; Hello World drawing, touch, icon, side-button exit; launcher clear order; loader core present.`);
