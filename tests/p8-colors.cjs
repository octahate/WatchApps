const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function color(r,g,b) {
  if (typeof r === 'string') {
    let hex=r.replace('#','');
    if(hex.length===3) hex=hex.split('').map(c=>c+c).join('');
    const rgb=parseInt(hex,16);
    return color(((rgb>>16)&255)/255,((rgb>>8)&255)/255,(rgb&255)/255);
  }
  if (g===undefined) return r&65535;
  return (Math.round(r*31)<<11)|(Math.round(g*63)<<5)|Math.round(b*31);
}
function runtime(theme) {
  class Graphics {
    constructor(w=240,h=240) {this.w=w;this.h=h;this.ops=[];this.reset();}
    reset(){this.fg=65535;this.bg=0;return this;}
    getWidth(){return this.w;}
    getHeight(){return this.h;}
    setColor(...args){this.fg=color(...args);return this;}
    setBgColor(...args){this.bg=color(...args);return this;}
    getColor(){return this.fg;}
    getBgColor(){return this.bg;}
    toColor(...args){return color(...args);}
    clear(reset){if(reset)this.reset();return this.clearRect(0,0,this.w-1,this.h-1);}
    transformVertices(v){return v;}
  }
  for(const method of ['clearRect','fillRect','drawImage','drawString','drawCircle','fillCircle','fillEllipse','drawLine','fillPoly','flip']) {
    Graphics.prototype[method]=function(...args){this.ops.push({method,fg:this.fg,bg:this.bg,args});return this;};
  }
  for(const method of ['setFont','setFontCustom','setFontAlign']) Graphics.prototype[method]=function(){return this;};
  Graphics.createArrayBuffer=(w,h)=>new Graphics(w,h);
  const saved={theme,bright:0.5,ontime:10};
  const storage={
    readJSON:file=>file==='alarm.json'?[{on:true}]:file==='settings.json'?JSON.parse(JSON.stringify(saved)):undefined,
    writeJSON:(file,value)=>{assert.equal(file,'settings.json');Object.assign(saved,JSON.parse(JSON.stringify(value)));},
    read:()=>undefined,
    list:()=>[]
  };
  const ctx={g:new Graphics(),Graphics,WIDGETS:{},wOS:{settings:saved,on:()=>{},isCharging:()=>false,setLCDTimeout:()=>{}},E:{getBattery:()=>100,showMenu:menu=>{ctx.menu=menu;return{draw:()=>{}};}},require:()=>storage,atob:s=>Buffer.from(s,'base64').toString('binary'),process:{env:{BOARD:'P8'}}};
  ctx.global=ctx;vm.createContext(ctx);
  const run=file=>vm.runInContext(fs.readFileSync(file,'utf8'),ctx);
  run('apps/main/theme.js');
  return {ctx,saved,run};
}
const palettes=[{fg:65535,bg:0,fg2:2047,bg2:0,fgH:65535,bgH:31},{fg:0,bg:65535,fg2:31,bg2:2047,fgH:0,bgH:2047}];
for(const palette of palettes) {
  const {ctx,saved,run}=runtime(palette);
  const g=ctx.g;
  g.setColor(123).setBgColor(456).setFont('6x8',3);
  g.reset();assert.equal(g.fg,palette.fg);assert.equal(g.bg,palette.bg);
  g.setBgColor(99);g.clear();assert.equal(g.ops.at(-1).bg,99);
  g.clear(true);assert.equal(g.ops.at(-1).bg,palette.bg);
  assert.deepEqual(g.ops.at(-1).args,[0,0,239,239]);
  // Theme changes in the real Settings app must persist and survive app recreation.
  run('apps/setting/setting.app.js');
  for(let i=0;i<12;i++) {
    ctx.showThemeMenu();ctx.menu[i%2?'Dark BW':'Light BW']();
    g.setBgColor(99);g.reset();assert.equal(g.bg,saved.theme.bg);assert.equal(g.fg,saved.theme.fg);
  }
  ctx.wOS.applyTheme(palette);
  const reboot=runtime(saved.theme);assert.equal(reboot.ctx.g.bg,palette.bg);assert.equal(reboot.ctx.g.fg,palette.fg);
  // Re-running the compatibility helper must not wrap its own reset recursively.
  run('apps/main/theme.js');g.reset();assert.equal(g.bg,palette.bg);
  run('apps/main/widgets.js');
  ctx.WIDGETS={leak:{area:'tl',width:8,draw:()=>g.setColor(123).setBgColor(456)},probe:{area:'tr',width:8,draw:()=>{assert.equal(g.fg,palette.fg);assert.equal(g.bg,palette.bg);}}};
  ctx.wOS.drawWidgets();assert.equal(g.fg,palette.fg);assert.equal(g.bg,palette.bg);
  ctx.WIDGETS={};
  run('apps/widbat/widget.js');
  ctx.WIDGETS.bat.x=0;ctx.WIDGETS.bat.y=0;g.ops=[];ctx.WIDGETS.bat.draw();
  assert.equal(g.ops.find(o=>o.method==='fillRect').fg,palette.fg);
  assert.equal(g.ops.find(o=>o.method==='clearRect').bg,palette.bg);
  run('apps/alarm/widget.js');ctx.WIDGETS.alarm.x=0;ctx.WIDGETS.alarm.y=0;
  g.ops=[];ctx.WIDGETS.alarm.draw();assert.equal(g.ops.at(-1).fg,palette.fg);
  run('apps/widmp/widget.js');ctx.WIDGETS.widmoon.x=0;ctx.WIDGETS.widmoon.y=0;
  ctx.WIDGETS.widmoon.draw();
  for(const file of ['digi.face.js','braun1.face.js','ana.face.js']) {
    const getFace=run('apps/multiclock/'+file);g.reset();
    const face=getFace();face.init();face.tick();
    assert.equal(g.bg,palette.bg,`Clock leaked background: ${file}`);
  }
}
const partial=runtime({fg:65535,bg:65535});assert.notEqual(partial.ctx.g.fg,partial.ctx.g.bg);
assert(fs.readFileSync('apps/main/main.js','utf8').includes('eval(STOR.read("theme.js"))'));
console.log('Passed: P8 theme reset/clear, Settings persistence, app recreation, widget isolation and light/dark clocks.');
