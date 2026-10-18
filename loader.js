/* P8-only configuration for the shared Espruino App Loader. */
Puck.debug = 3;
// Keep the page, device configuration and catalog on the same published revision.
var p8HttpGet = httpGet;
httpGet = function (url) {
  if (url === "apps.json" || url.indexOf("apps/") === 0) {
    url += (url.indexOf("?") >= 0 ? "&" : "?") + "v=__P8_BUILD__";
  }
  return p8HttpGet(url);
};
Const.SINGLE_APP_ONLY = false;
Const.HAS_E_SHOWMESSAGE = true;
Const.MESSAGE_RELOAD = "Hold the side button to open the launcher";
Const.APP_SOURCECODE_URL = "https://github.com/octahate/WatchApps/tree/master/apps";

DEVICEINFO = [{
  id: "P8",
  name: "P8",
  features: ["BLE", "GRAPHICS", "ACCEL", "TOUCH"],
  g: {width: 240, height: 240, bpp: 16},
  img: "img/p8.jpeg"
}];

// Filter before the first catalog render; no watch-selection dialog is needed.
function onAppJSONLoaded() {
  appJSON = appJSON.filter(function (app) {
    return app.supports && app.supports.indexOf("P8") >= 0;
  });
}

function onFoundDeviceInfo(deviceId) {
  if (deviceId !== "P8") {
    throw new Error("This app store supports P8 watches only. Connected device: " + deviceId);
  }
}

document.getElementById("apploaderlinks").textContent =
  "Personal app store for P8 / MOY-TIN5. Based on Jeff Magee’s WatchApps and Espruino.";
