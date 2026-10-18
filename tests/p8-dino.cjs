const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('apps/dinorun/app.js','utf8');

function watch(renderMs=8) {
  let now=0, next=1, touch, kill, power, writes=0, saved='', frames=0;
  const timers=new Map(), text=[], rexY=[], transfers=[];
  const chain={};
  for (const k of ['reset','setColor','setBgColor','setFont','setFontAlign','clear','clearRect']) chain[k]=function(){return this;};
  const screen=Object.assign({},chain,{
    getWidth:()=>240,getHeight:()=>240,
    drawImage(im,x,y){
      frames++;transfers.push(im.width*im.height);
      const patch=new Uint8Array(im.buffer), original=new Uint8Array(buffer.buffer);
      for(let row=0;row<im.height;row++)for(let col=0;col<im.width;col++) {
        const bit=(patch[row*im.width/8+(col>>3)]>>(7-(col&7)))&1;
        const sx=x/2+col, sy=(y-56)/2+row;
        assert.equal(bit,(original[sy*15+(sx>>3)]>>(7-(sx&7)))&1,'patch pixels must match the composed frame');
      }
      now+=renderMs/1000;return this;
    },
    drawString(s){text.push(String(s));return this;},flip(){}
  });
  let buffer;
  const graphics={
    createImage(s){
      const rows=s.replace(/^\n/,'').replace(/\n$/,'').split('\n');
      return {width:Math.max(...rows.map(r=>r.length)),height:rows.length,rows};
    },
    createArrayBuffer(w,h,bpp){
      assert.equal(bpp,1);
      const pixels=new Uint8Array(w*h);
      buffer=Object.assign({},chain,{
        buffer:new ArrayBuffer(w*h/8),getWidth:()=>w,
        clear(){pixels.fill(0);new Uint8Array(this.buffer).fill(0);return this;},
        clearRect(x1,y1,x2,y2){for(let y=y1;y<=y2;y++)for(let x=x1;x<=x2;x++)this.pixel(x,y,0);return this;},
        pixel(x,y,v){x=Math.floor(x);y=Math.floor(y);if(x>=0&&x<w&&y>=0&&y<h){
          pixels[y*w+x]=v;
          const packed=new Uint8Array(this.buffer), index=y*15+(x>>3), mask=1<<(7-(x&7));
          packed[index]=v?packed[index]|mask:packed[index]&~mask;
        }},
        getPixel(x,y){x=Math.floor(x);y=Math.floor(y);return x>=0&&x<w&&y>=0&&y<h?pixels[y*w+x]:0;},
        drawLine(x,y,x2){for(;x<=x2;x++)this.pixel(x,y,1);return this;},
        drawImage(im,x,y){
          if(im.rows){
            if(im.height===22)rexY.push(y);
            im.rows.forEach((row,dy)=>{for(let dx=0;dx<row.length;dx++)if(row[dx]==='#')this.pixel(x+dx,y+dy,1);});
          }
          return this;
        },
        drawString(s){text.push(String(s));return this;},stringWidth:s=>s.length*4
      });
      return buffer;
    }
  };
  const ctx={g:screen,Graphics:graphics,Uint8Array,Math:Object.create(Math),getTime:()=>now,
    require:n=>{assert.equal(n,'Storage');return {open:(name,mode)=>{
      assert.equal(name,'dinorun.score');
      return {readLine:()=>saved,write:s=>{assert.equal(mode,'w');saved=s;writes++;}};
    }};},
    setTimeout:(fn,ms)=>{const id=next++;timers.set(id,{fn,time:now+ms/1000});return id;},
    clearTimeout:id=>{assert.notEqual(id,undefined);timers.delete(id);},
    Bangle:{setLCDPower(){},setUI(type,fn){assert.equal(type,'touch');touch=fn;},on(event,fn){assert.equal(event,'lcdPower');power=fn;},removeListener(event,fn){assert.equal(fn,power);power=undefined;}},
    E:{on(event,fn){assert.equal(event,'kill');kill=fn;}},print:()=>{}
  };
  ctx.Math.random=()=>0.5;
  vm.runInNewContext(source,ctx);
  assert.equal(ctx.g,screen,'global panel graphics must survive');
  assert.equal(buffer.buffer.byteLength,960);
  function advance(seconds){
    const end=now+seconds;
    for(let safety=0;safety<20000;safety++){
      const first=[...timers.entries()].sort((a,b)=>a[1].time-b[1].time)[0];
      if(!first||first[1].time>end){now=Math.max(now,end);return;}
      now=Math.max(now,first[1].time);timers.delete(first[0]);first[1].fn();
    }
    throw Error('timer loop failed to settle');
  }
  return {text,rexY,timers,transfers,advance,tap:()=>touch(),power:on=>power(on),kill:()=>kill(),get frames(){return frames;},get writes(){return writes;},get saved(){return saved;}};
}

const game=watch();
assert(game.text.includes('TAP TO START'));
game.tap();game.advance(2);
assert(game.text.some(s=>/^FPS 20\./.test(s)), 'normal display should measure about 20 FPS');
assert.equal(game.writes,0,'do not write flash each frame');
const activeTransfers=game.transfers.slice(2);
assert(activeTransfers.length>10);
assert(activeTransfers.every(area=>area<120*64),'active frames must avoid full-playfield transfers');
assert(activeTransfers.reduce((a,b)=>a+b,0)/activeTransfers.length<120*64/3,'patches should be substantially smaller');
game.power(false);const stopped=game.frames;game.advance(2);
assert.equal(game.frames,stopped,'sleep must pause rendering');
game.power(true);game.advance(0.5);assert(game.frames>stopped);
game.advance(4);assert(game.text.includes('GAME OVER'),'cactus pixel collision must end the game');
assert.equal(game.writes,1);assert(parseInt(game.saved)>0);
game.tap();game.advance(0.2);assert(game.frames>stopped);
const systemTimer=12345;game.timers.set(systemTimer,{time:Infinity,fn(){}});
game.kill();assert(game.timers.has(systemTimer),'cleanup must preserve system timers');
assert.equal(game.timers.size,1,'cleanup removes all owned timers');

const jumper=watch();jumper.tap();jumper.advance(3.7);jumper.tap();jumper.advance(0.5);
assert(jumper.rexY.some(y=>y<20),'touch must trigger a visible jump');
assert(!jumper.text.includes('GAME OVER'),'jump should clear the approaching cactus');
jumper.kill();assert.equal(jumper.writes,1,'exit saves an unfinished best run');

const slow=watch(90);slow.tap();slow.advance(2);
const rates=slow.text.filter(s=>/^FPS \d/.test(s)).map(s=>Number(s.slice(4)));
assert(rates.length && rates.every(n=>n<15),'FPS must measure actual render throughput');
slow.kill();
console.log('Passed: P8 Dino collision, jump, FPS, sleep, score and timer checks');
