/* Keep the P8's JavaScript theme and native graphics state in agreement. */
(function () {
  var nativeReset = g._p8BaseReset || g.reset;
  g._p8BaseReset = nativeReset;

  g.reset = function () {
    nativeReset.call(this);
    return this.setColor(this.theme.fg).setBgColor(this.theme.bg);
  };
  g.clear = function (resetState) {
    if (resetState) this.reset();
    return this.clearRect(0, 0, this.getWidth() - 1, this.getHeight() - 1);
  };

  wOS.applyTheme = function (source) {
    source = source || {};
    var defaults = {fg:65535, bg:0, fg2:2047, bg2:0, fgH:65535, bgH:31};
    var theme = {};
    Object.keys(defaults).forEach(function (key) {
      theme[key] = typeof source[key] === "number" ? source[key] & 65535 : defaults[key];
    });
    if (theme.fg === theme.bg) theme.fg = theme.bg === 0 ? 65535 : 0;
    var red = (theme.bg >> 11) & 31;
    var green = (theme.bg >> 5) & 63;
    var blue = theme.bg & 31;
    theme.dark = (red * 299 / 31 + green * 587 / 63 + blue * 114 / 31) < 500;
    g.theme = theme;
    if (wOS.settings) wOS.settings.theme = theme;
    g.reset();
    return theme;
  };
  g.setTheme = function (theme) {
    wOS.applyTheme(theme);
    return this;
  };
  wOS.applyTheme(wOS.settings && wOS.settings.theme);
})();
