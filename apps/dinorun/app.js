/* Dino Runner for P8, adapted from BangleApps apps/trex/trex.js.
 * Copyright 2019 Gordon Williams, Pur3 Ltd; BangleApps contributors.
 * MIT license: see LICENSE and the installed dinorun.license file.
 * P8 port: touch controls, owned timers, display sleep handling and measured FPS.
 */
(function (screen) {
  var storage = require("Storage");
  function loadHighScore() {
    var f = storage.open("dinorun.score", "r");
    return Math.max(0, parseInt(f.readLine(), 10) || 0);
  }
  function saveHighScore(score) {
    storage.open("dinorun.score", "w").write(score + "\n");
  }

  // Preserve the real global graphics object for the P8's power/display drivers.
  var g = Graphics.createArrayBuffer(120, 64, 1, {msb:true});
  g.setColor(1).setBgColor(0).setFont("4x6").setFontAlign(-1,-1);
  var W = g.getWidth();
  var image = {width:120, height:64, bpp:1, buffer:g.buffer};
  var top = (screen.getHeight() - 128) / 2;
  var interval = 50;
  var lastStep = 0, forceFull = true, previousRects = [];
  var pixels = new Uint8Array(g.buffer);
  var timer, saveTimer;
  var paused = false, closed = false;
  var jumpQueued = false;
  var cacti, rex, frame;
  var highScore = loadHighScore(), displayedHighScore;
  var scoreDirty = false, crashedAt = 0;
  var fpsStart = 0, fpsFrames = 0, fpsText = "--";

var IMG = {
  rex: [Graphics.createImage(`
           ########
          ##########
          ## #######
          ##########
          ##########
          ##########
          #####
          ########
#        #####
#      #######
##    ##########
###  ######### #
##############
##############
 ############
  ###########
   #########
    #######
     ### ##
     ##   #
          #
          ##
`),Graphics.createImage(`
           ########
          ##########
          ## #######
          ##########
          ##########
          ##########
          #####
          ########
#        #####
#      #######
##    ##########
###  ######### #
##############
##############
 ############
  ###########
   #########
    #######
     ### ##
     ##   ##
     #
     ##
`),Graphics.createImage(`
           ########
          #   ######
          # # ######
          #   ######
          ##########
          ##########
          #####
          ########
#        #####
#      #######
##    ##########
###  ######### #
##############
##############
 ############
  ###########
   #########
    #######
     ### ##
     ##   #
     #    #
     ##   ##
`)],
  cacti: [Graphics.createImage(`
     ##
    ####
    ####
    ####
    ####
    ####  #
 #  #### ###
### #### ###
### #### ###
### #### ###
### #### ###
### #### ###
### #### ###
### #### ###
###########
 #########
    ####
    ####
    ####
    ####
    ####
    ####
    ####
    ####
`),Graphics.createImage(`
   ##
   ##
 # ##
## ##  #
## ##  #
## ##  #
## ##  #
#####  #
 ####  #
   #####
   ####
   ##
   ##
   ##
   ##
   ##
   ##
   ##
`)],
};
IMG.rex.forEach(i=>i.transparent=0);
IMG.cacti.forEach(i=>i.transparent=0);
  function drawFPS() {
    screen.setBgColor(65535).setColor(0);
    screen.clearRect(0,0,85,17);
    screen.setFont("6x8",1).setFontAlign(-1,-1);
    screen.drawString("FPS " + fpsText,4,5);
    if (screen.flip) screen.flip();
  }
  function resetFPS() {
    fpsStart = getTime(); fpsFrames = 0; fpsText = "--";
    drawFPS();
  }
  function paintChrome() {
    forceFull = true;
    screen.reset().setBgColor(65535).setColor(0).clear();
    screen.setFont("6x8",2).setFontAlign(0,-1);
    screen.drawString("DINO RUNNER",screen.getWidth()/2,27);
    screen.setFont("6x8",1);
    screen.drawString("Tap: jump / restart",screen.getWidth()/2,201);
    screen.drawString("Side button: exit",screen.getWidth()/2,217);
    drawFPS();
  }
  function spriteRects() {
    var y=Math.floor(38-rex.y);
    var rects=[[8,y,31,y+22]];
    for (var i=0;i<cacti.length;i++) {
      var c=cacti[i], im=IMG.cacti[c.img];
      if (c.x<120) rects.push([Math.floor(c.x)-1,60-im.height,Math.floor(c.x)+im.width,60]);
    }
    return rects;
  }
  function drawPatch(r) {
    var x1=Math.max(0,Math.floor(r[0]/8)), x2=Math.min(14,Math.floor(r[2]/8));
    var y1=Math.max(0,r[1]), y2=Math.min(63,r[3]);
    if (x2<x1 || y2<y1) return;
    var stride=x2-x1+1, bytes=new Uint8Array(stride*(y2-y1+1)), n=0;
    for (var y=y1;y<=y2;y++) for (var x=x1;x<=x2;x++) bytes[n++]=pixels[y*15+x];
    screen.drawImage({width:stride*8,height:y2-y1+1,bpp:1,buffer:bytes.buffer},x1*16,top+y1*2,{scale:2});
  }
  function present(countFrame) {
    screen.reset().setBgColor(65535).setColor(0);
    if (forceFull || !rex || !rex.alive) {
      screen.drawImage(image,0,top,{scale:2});
      forceFull = false;
    } else {
      // Transfer only sprite regions and the score, never the whole playfield.
      var rects = previousRects.concat(spriteRects());
      rects.push([80,0,119,14]);
      for (var i=0;i<rects.length;i++) {
        var r=rects[i];
        for (var j=i+1;j<rects.length;j++) {
          var b=rects[j];
          if (r[0]<=b[2]+8 && b[0]<=r[2]+8 && r[1]<=b[3]+2 && b[1]<=r[3]+2) {
            r=[Math.min(r[0],b[0]),Math.min(r[1],b[1]),Math.max(r[2],b[2]),Math.max(r[3],b[3])];
            rects[i]=r; rects.splice(j,1); j=i;
          }
        }
        drawPatch(r);
      }
    }
    previousRects = rex ? spriteRects() : [];
    if (screen.flip) screen.flip();
    if (!countFrame) return;
    fpsFrames++;
    var elapsed = getTime() - fpsStart;
    if (elapsed >= 1) {
      fpsText = (fpsFrames / elapsed).toFixed(1);
      fpsStart = getTime(); fpsFrames = 0;
      drawFPS();
    }
  }
  function stopLoop() {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  }
  function commitScore() {
    saveTimer = undefined;
    if (!scoreDirty) return;
    try { saveHighScore(highScore); scoreDirty = false; }
    catch (e) { print("High score not saved:",e); }
  }
  function gameStart() {
    if (closed || paused) return;
    stopLoop();
    rex = {alive:true, img:0, x:10, y:0, vy:0, score:0};
    cacti = [{x:W, img:1}];
    var random = new Uint8Array(128*3/8);
    for (var i=0;i<50;i++) {
      var a = 0|(Math.random()*random.length);
      random[a] |= 1<<(0|(Math.random()*8));
    }
    IMG.ground = {width:128, height:3, bpp:1, buffer:random.buffer};
    frame = 0; jumpQueued = false;
    displayedHighScore = highScore;
    Bangle.setLCDPower(true);
    resetFPS();
    forceFull=true; previousRects=[];
    lastStep=getTime()-interval/1000;
    loop();
  }
  function gameStop() {
    rex.alive = false; rex.img = 2;
    crashedAt = getTime();
    stopLoop();
    if (rex.score > highScore) {
      highScore = rex.score; scoreDirty = true;
      saveTimer = setTimeout(commitScore,200);
    }
  }
  function onFrame(render) {
    "ram"
    g.clear();
    if (rex.alive) {
      frame++; rex.score++;
      if (!(frame&3)) rex.img = rex.img ? 0 : 1;
      // Original T-Rex jump integration; touch replaces BTN1.read().
      if (jumpQueued && rex.y===0) rex.vy = 4;
      jumpQueued = false;
      rex.y += rex.vy;
      rex.vy -= 0.2;
      if (rex.y<=0) { rex.y=0; rex.vy=0; }
      var lastCactix = cacti.length ? cacti[cacti.length-1].x : W-1;
      if (lastCactix<W) {
        // Space obstacles for one-button/touch play without lateral movement.
        cacti.push({x:lastCactix+55+Math.random()*W*0.6, img:Math.random()>0.5?1:0});
      }
      for (var i=0;i<cacti.length;i++) cacti[i].x--;
      while (cacti.length && cacti[0].x<0) cacti.shift();
      Bangle.setLCDPower(true);
    }
    g.drawLine(0,60,W-1,60);
    for (var j=0;j<cacti.length;j++) {
      var c = cacti[j];
      g.drawImage(IMG.cacti[c.img],c.x,60-IMG.cacti[c.img].height);
    }
    // Upstream collision samples test actual cactus pixels, before drawing rex.
    var rexx=rex.x, rexy=38-rex.y;
    if (rex.alive && (
      g.getPixel(rexx+0,rexy+13) || g.getPixel(rexx+2,rexy+15) ||
      g.getPixel(rexx+5,rexy+19) || g.getPixel(rexx+10,rexy+19) ||
      g.getPixel(rexx+12,rexy+15) || g.getPixel(rexx+13,rexy+13) ||
      g.getPixel(rexx+15,rexy+11) || g.getPixel(rexx+17,rexy+7) ||
      g.getPixel(rexx+19,rexy+5) || g.getPixel(rexx+19,rexy+1))) gameStop();
    g.drawImage(IMG.rex[rex.img],rexx,rexy);
    var groundOffset=0; // Static ground avoids a full-width transfer every frame.
    g.drawImage(IMG.ground,-groundOffset,61);
    g.drawImage(IMG.ground,128-groundOffset,61);
    var hi="HI "+displayedHighScore, score=""+rex.score;
    g.drawString(hi,W-g.stringWidth(hi),0);
    g.drawString(score,W-g.stringWidth(score),8);
    if (!rex.alive) {
      g.clearRect(23,15,97,33);
      var msg="GAME OVER";
      g.drawString(msg,(W-g.stringWidth(msg))/2,16);
      msg=rex.score>displayedHighScore?"NEW RECORD":"Tap to retry";
      g.drawString(msg,(W-g.stringWidth(msg))/2,25);
    }
    if (render !== false || !rex.alive) present(true);
  }
  function loop() {
    timer = undefined;
    if (closed || paused || !rex || !rex.alive) return;
    var started = getTime();
    var steps=Math.min(5,Math.max(1,Math.floor((started-lastStep)*1000/interval)));
    lastStep+=steps*interval/1000;
    for (var n=0;n<steps && rex.alive;n++) onFrame(n===steps-1);
    if (rex.alive && !paused && !closed) {
      timer = setTimeout(loop,Math.max(1,interval-(getTime()-started)*1000));
    }
  }
  function drawReady() {
    g.clear();
    g.drawLine(0,60,W-1,60);
    g.drawImage(IMG.rex[0],10,38);
    var msg="TAP TO START";
    g.drawString(msg,(W-g.stringWidth(msg))/2,17);
    present(false);
  }
  function touch() {
    if (closed || paused) return;
    if (!rex) gameStart();
    else if (!rex.alive) {
      if (getTime()-crashedAt>=0.65) gameStart();
    } else if (rex.y===0) jumpQueued=true;
  }
  function powerChanged(on) {
    paused = !on;
    stopLoop();
    if (!on || closed) return;
    paintChrome(); resetFPS(); lastStep=getTime();
    if (rex) {
      onFrame();
      if (rex.alive) timer=setTimeout(loop,interval);
    } else drawReady();
  }
  function cleanup() {
    closed=true;
    stopLoop();
    if (saveTimer!==undefined) clearTimeout(saveTimer);
    saveTimer=undefined;
    if (rex && rex.score>highScore) {highScore=rex.score;scoreDirty=true;}
    commitScore();
    Bangle.removeListener("lcdPower",powerChanged);
  }
  Bangle.setLCDPower(true);
  paintChrome();
  drawReady();
  Bangle.setUI("touch",touch);
  Bangle.on("lcdPower",powerChanged);
  E.on("kill",cleanup);
})(g);
