const assert = require('node:assert/strict');
const fs = require('node:fs');
const cp = require('node:child_process');
const vm = require('node:vm');
const catalog = JSON.parse(fs.readFileSync('apps.json', 'utf8'));
const upstream = JSON.parse(cp.execFileSync('git', ['show', 'd8dff30062ebdb14a727d5340129a68471f069eb:apps.json'], {encoding:'utf8'}));
for (const app of upstream) {
  const current = catalog.find(a => a.id === app.id);
  assert(current, `Missing original app: ${app.id}`);
  if (app.id !== 'launch') assert.deepEqual(current, app);
  else {
    assert.deepEqual(current.storage, app.storage);
    assert.deepEqual(current.supports, app.supports);
    assert.notEqual(current.version, app.version);
  }
}
assert.equal(new Set(catalog.map(a => a.id)).size, catalog.length);
const hello = catalog.find(a => a.id === 'hello');
assert.deepEqual(hello.supports, ['P8']);
for (const item of hello.storage) assert(fs.existsSync(`apps/hello/${item.url}`));
const icon = vm.runInNewContext(fs.readFileSync('apps/hello/app-icon.js', 'utf8'), {atob:s=>Buffer.from(s,'base64')});
assert.equal(icon.length, 3 + 48 * 48 / 8);
assert.deepEqual(Array.from(icon.subarray(0,3)), [48,48,1]);
let touch;
let draws = [];
const g = {theme:{fg:'#fff'}, getWidth:()=>240, getHeight:()=>240};
for (const key of ['reset','clear','setColor','setFontAlign','setFont','flip']) g[key] = () => g;
g.drawString = text => {draws.push(text); return g;};
const context = {g, Bangle:{setUI:(mode,cb)=>{assert.equal(mode,'touch');touch=cb;}}};
vm.runInNewContext(fs.readFileSync('apps/hello/app.js','utf8'), context);
assert(draws.includes('Hello World!'));
touch(); assert(draws.includes('Greetings: 1'));
touch(); assert(draws.includes('Greetings: 2'));
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
console.log(`Passed: all ${upstream.length} original apps preserved; Hello World drawing, touch, icon, side-button exit; launcher clear order; loader core present.`);
