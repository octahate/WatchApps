(function () {
  var taps = 0;

  function draw() {
    var w = g.getWidth();
    var h = g.getHeight();
    g.reset();
    g.clear();
    g.setColor(g.theme.fg);
    g.setFontAlign(0, 0);
    g.setFont("Vector", 28);
    g.drawString("Hello World!", w / 2, h / 2 - 38);
    g.setFont("6x8", 2);
    g.drawString(taps ? "Greetings: " + taps : "Your first P8 app", w / 2, h / 2 + 2);
    g.setFont("6x8", 1);
    g.drawString("Tap to say hello", w / 2, h - 48);
    g.drawString("Side button: launcher", w / 2, h - 30);
    if (g.flip) g.flip();
  }

  Bangle.setUI("touch", function () {
    taps++;
    draw();
  });
  draw();
})();
