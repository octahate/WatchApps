(function(){
  var Y=0;

  function setWidth() {
    WIDGETS["bat"].width = 40 + (wOS.isCharging()?16:0);
  }

  function draw() {
    g.reset();
    var CHARGING = g.toColor(0, g.theme.dark ? 1 : 0.5, 0);
    var s = 39;
    var x = this.x, y = this.y;
    Y = y;
    if (wOS.isCharging()) {
      g.setColor(CHARGING).drawImage(atob("DhgBHOBzgc4HOP////////////////////3/4HgB4AeAHgB4AeAHgB4AeAHg"),x,y);
      x+=16;
    }
    g.setColor(g.theme.fg);
    g.fillRect(x,y+2,x+s-4,y+21);
    g.clearRect(x+2,y+4,x+s-6,y+19);
    g.fillRect(x+s-3,y+10,x+s,y+14);
    var level = Math.max(0, Math.min(100, E.getBattery()));
    var width = Math.ceil(level * (s-12) / 100);
    if (width) g.setColor(CHARGING).fillRect(x+4,y+6,x+3+width,y+17);
    g.setColor(g.theme.fg);
  }

  wOS.on('charging',function(charging) {
    setWidth();
    wOS.drawWidgets(Y); // relayout widgets
    g.flip();
  });

  WIDGETS["bat"]={area:"tr",width:40,draw:draw};
  setWidth();
})()

