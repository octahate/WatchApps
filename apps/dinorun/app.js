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
  var g = Graphics.createArrayBuffer(120, 52, 1, {msb:true});
  g.setColor(1).setBgColor(0).setFont("4x6").setFontAlign(-1,-1);
  var W = g.getWidth(), H = g.getHeight();
  var image = {width:W, height:H, bpp:1, buffer:g.buffer};
  var left = Math.round((screen.getWidth() - W) / 2);
  var top = Math.round((screen.getHeight() - H) / 2);
  var interval = 50;
  var lastStep = 0;
  var drawMs=0, logicMs=0;
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
IMG.rex.forEach(function(i) { i.transparent = 0; });
IMG.cacti.forEach(function(i) { i.transparent = 0; });
  function drawFPS() {
    screen.setBgColor(65535).setColor(0);
    screen.clearRect(0,0,159,24);
    screen.setFont("6x8",1).setFontAlign(-1,-1);
    screen.drawString("FPS " + fpsText,4,5);
    screen.drawString("D:"+drawMs+" L:"+logicMs+" ms",4,16);
    if (screen.flip) screen.flip();
  }
  function resetFPS() {
    fpsStart = getTime(); fpsFrames = 0; fpsText = "--";
    drawFPS();
  }
  function paintChrome() {
    screen.reset().setBgColor(65535).setColor(0).clear();
    screen.setFont("6x8",2).setFontAlign(0,-1);
    screen.drawString("DINO RUNNER",screen.getWidth()/2,28);
    screen.drawRect(left-2,top-2,left+W+1,top+H+1);
    screen.setFont("6x8",1);
    screen.drawString("Tap: jump / restart",screen.getWidth()/2,175);
    screen.drawString("Side button: exit",screen.getWidth()/2,195);
    drawFPS();
  }
  function present(countFrame) {
    var drawStarted=getTime();
    screen.reset().setBgColor(65535).setColor(0);
    // Double-buffered: blast the composed 120x52 RAM buffer in a single hardware SPI burst.
    // Zero clearRect on physical display = zero flicker and zero strobing.
    screen.drawImage(image,left,top);
    if (screen.flip) screen.flip();
    drawMs=Math.round((getTime()-drawStarted)*1000);
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
    var logicStarted=getTime();
    g.clear();
    if (rex.alive) {
      frame++; rex.score++;
      if (!(frame&3)) rex.img = rex.img ? 0 : 1;
      // Touch jump physics adapted for 120x52 single-buffer display.
      if (jumpQueued && rex.y===0) rex.vy = 3.4;
      jumpQueued = false;
      rex.y += rex.vy;
      rex.vy -= 0.2;
      if (rex.y<=0) { rex.y=0; rex.vy=0; }
      var lastCactix = cacti.length ? cacti[cacti.length-1].x : W-1;
      if (lastCactix<W) {
        cacti.push({x:lastCactix+80+Math.random()*W*0.5, img:Math.random()>0.5?1:0});
      }
      for (var i=0;i<cacti.length;i++) cacti[i].x -= 2;
      while (cacti.length && cacti[0].x<-20) cacti.shift();
    }
    g.drawLine(0,48,W-1,48);
    for (var j=0;j<cacti.length;j++) {
      var c = cacti[j];
      g.drawImage(IMG.cacti[c.img],c.x,48-IMG.cacti[c.img].height);
    }
    // Upstream collision samples test actual cactus pixels, before drawing rex.
    var rexx=rex.x, rexy=Math.floor(26-rex.y);
    if (rex.alive && (
      g.getPixel(rexx+0,rexy+13) || g.getPixel(rexx+2,rexy+15) ||
      g.getPixel(rexx+5,rexy+19) || g.getPixel(rexx+10,rexy+19) ||
      g.getPixel(rexx+12,rexy+15) || g.getPixel(rexx+13,rexy+13) ||
      g.getPixel(rexx+15,rexy+11) || g.getPixel(rexx+17,rexy+7) ||
      g.getPixel(rexx+19,rexy+5) || g.getPixel(rexx+19,rexy+1))) gameStop();
    g.drawImage(IMG.rex[rex.img],rexx,rexy);
    var groundOffset=(frame*2)&127;
    g.drawImage(IMG.ground,-groundOffset,49);
    g.drawImage(IMG.ground,128-groundOffset,49);
    var hi="HI "+displayedHighScore, score=""+rex.score;
    g.drawString(hi,W-g.stringWidth(hi)-4,2);
    g.drawString(score,W-g.stringWidth(score)-4,10);
    if (!rex.alive) {
      g.clearRect(W/2-45,15,W/2+45,37);
      var msg="GAME OVER";
      g.drawString(msg,(W-g.stringWidth(msg))/2,17);
      msg=rex.score>displayedHighScore?"NEW RECORD":"Tap to retry";
      g.drawString(msg,(W-g.stringWidth(msg))/2,27);
    }
    logicMs+=Math.round((getTime()-logicStarted)*1000);
    if (render !== false || !rex.alive) present(true);
  }
  function loop() {
    timer = undefined;
    if (closed || paused || !rex || !rex.alive) return;
    var started = getTime();
    logicMs=0;
    var steps=Math.min(2,Math.max(1,Math.floor((started-lastStep)*1000/interval)));
    lastStep=started;
    for (var n=0;n<steps && rex.alive;n++) onFrame(n===steps-1);
    if (rex.alive && !paused && !closed) {
      timer = setTimeout(loop,Math.max(1,interval-(getTime()-started)*1000));
    }
  }
  function drawReady() {
    g.clear();
    g.drawLine(0,48,W-1,48);
    g.drawImage(IMG.rex[0],10,26);
    var msg="TAP TO START";
    g.drawString(msg,(W-g.stringWidth(msg))/2,16);
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
