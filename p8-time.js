/* P8 settings use settings.json, not the shared loader's setting.json. */
Comms.setTime = function () {
  return Comms.write("\x03").then(function () {
    var now = new Date();
    var timezone = -now.getTimezoneOffset() / 60;
    var command = "\x10setTime(" + now.getTime() / 1000 + ");";
    command += "E.setTimeZone(" + timezone + ");";
    command += "(function(){var s=require('Storage').readJSON('settings.json',1)||{};";
    command += "s.timezone=" + timezone + ";require('Storage').writeJSON('settings.json',s);";
    command += "if(typeof wOS!=='undefined'&&wOS.settings)wOS.settings.timezone=s.timezone;})();\n";
    return Comms.write(command);
  });
};
