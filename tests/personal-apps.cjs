const assert = require('node:assert/strict');
const fs = require('node:fs');
const cp = require('node:child_process');
const vm = require('node:vm');
require("./p8-colors.cjs");
require("./p8-dino.cjs");
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
  if (app.id === "main") expectedFiles.splice(expectedFiles.findIndex(f=>f.name==="main.js")+1,0,{name:"theme.js",url:"theme.js"});
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
const loaderContext = {httpGet:url=>url,Puck:{},Const:{},DEVICEINFO:[],document:{getElementById:()=>({})},appJSON:[...catalog,{id:'other',supports:['G5']}]};
vm.createContext(loaderContext);
vm.runInContext(fs.readFileSync('loader.js','utf8'),loaderContext);
assert.match(loaderContext.httpGet('apps.json'), /^apps.json\?v=/);
assert(loaderContext.httpGet('apps/hello/app.js').startsWith('apps/hello/app.js?v='));
assert.equal(loaderContext.httpGet('core/js/index.js'),'core/js/index.js');
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
// Verify every launcher redraw clears all pixels before restoring widgets and flushing.
for (const theme of [{fg:0,bg:65535},{fg:65535,bg:0}]) {
  for (const count of [0,7]) {
    const events = [];
    let ink;
    const lg = {theme,getWidth:()=>240,getHeight:()=>240};
    lg.reset=()=>{ink=65535;events.push(['reset']);return lg;};
    lg.setColor=v=>{ink=v;return lg;};
    lg.setBgColor=v=>{events.push(['background',v]);return lg;};
    lg.fillRect=(...rect)=>{events.push(['paint',ink,...rect]);return lg;};
    lg.flip=()=>{events.push(['flip']);};
    for (const key of ['fillCircle','drawCircle','setFontAlign','setFont','drawString','drawImage']) lg[key]=()=>lg;
    const Bangle = {loadWidgets:()=>events.push(['loadWidgets']),drawWidgets:()=>events.push(['widgets']),setLCDPower:on=>assert.equal(on,true),setUI:()=>{}};
    const ctx={g:lg,require:()=>({list:()=>Array.from({length:count},(_,i)=>i+'.info'),readJSON:name=>({name:'App '+name,src:name+'.js'})}),Bangle,TC:{on:()=>{}},global:{}};
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync('apps/launch/launch.js','utf8'),ctx);
    function verify() {
      const full=events.findIndex(e=>e[0]==='paint'&&e.slice(2).join(',')==='0,0,239,239');
      const widgets=events.findIndex(e=>e[0]==='widgets');
      const flip=events.findIndex(e=>e[0]==='flip');
      assert(full>=0,'Entire screen must be painted');
      assert.equal(events[full][1],theme.bg);
      assert(full<widgets&&widgets<flip,'Restore widgets after clearing, then flush');
    }
    verify();
    events.length=0;ctx.drawPage(count?1:0);verify();
    events.length=0;ctx.global.SCREENACCESS.release();verify();
  }
}
assert(fs.existsSync('core/js/index.js'));
assert(fs.existsSync('core/lib/espruinotools.js'));
async function testClockSync() {
  for (const timezone of [0,2,-5.5]) {
    const sent=[];
    let stored;
    let timestamp;
    let appliedZone;
    const now=1792355000000;
    const Comms={write:command=>{sent.push(command);return Promise.resolve('written');}};
    class Clock extends Date {constructor(){super(now);}getTimezoneOffset(){return -timezone*60;}}
    vm.runInNewContext(fs.readFileSync('p8-time.js','utf8'),{Comms,Date:Clock});
    assert.equal(await Comms.setTime(),'written');
    assert.equal(sent[0],'\x03');
    assert.equal(sent.length,2);
    const runtime={setTime:value=>timestamp=value,E:{setTimeZone:value=>appliedZone=value},wOS:{settings:{timezone:9}},require:name=>{assert.equal(name,'Storage');return {readJSON:(file)=>{assert.equal(file,'settings.json');return {timezone:9,bright:0.3};},writeJSON:(file,value)=>{assert.equal(file,'settings.json');stored=value;}};}};
    vm.runInNewContext(sent[1].slice(1),runtime);
    assert.equal(timestamp,now/1000);assert.equal(appliedZone,timezone);
    assert.equal(stored.timezone,timezone);assert.equal(stored.bright,0.3);
    assert.equal(runtime.wOS.settings.timezone,timezone);
  }
  const Comms={write:()=>Promise.reject(new Error('Disconnected'))};
  vm.runInNewContext(fs.readFileSync('p8-time.js','utf8'),{Comms,Date});
  await assert.rejects(Comms.setTime(),/Disconnected/);
}
testClockSync().then(()=>console.log(`Passed: ${catalog.length} P8 apps; Hello World; full-screen launcher redraws with widget restore and flush; clock sync and persisted time zones.`)).catch(error=>{console.error(error);process.exitCode=1;});
