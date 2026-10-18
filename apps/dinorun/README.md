# Dino Runner for P8

Tap to start, then tap to jump over cacti. After a crash, wait briefly and tap to retry. Press the side button to return to the launcher.

The upper-left FPS counter measures completed game display updates each second. The game targets 20 FPS; the measured rate depends on your watch. It shows `--` until the first measurement.

The screen stays awake during play. Display sleep pauses the game; waking resumes it. Your best score is saved after a crash and when leaving the app. Scores count survived physics steps at 20 steps per second. Version 0.04 pre-scales sprites 2x at startup to eliminate runtime scaling and transparency, enabling fast hardware SPI block transfers directly to the unbuffered ST7789 display. The timing line beneath FPS shows D (display) and L (logic) milliseconds for the last completed update. Physics catches up in fixed steps when rendering is slower, up to two steps per display update.

## Source and license

Adapted from [BangleApps T-Rex](https://github.com/espruino/BangleApps/blob/a468292536aaff5b34898f3b8edb4dcd797954f6/apps/trex/trex.js), MIT licensed, copyright Gordon Williams, Pur3 Ltd and BangleApps contributors. The original source is retained as `upstream.js` in this repository. The port reuses its dinosaur/cactus sprites, jumping physics, ground and pixel collision checks. P8 changes include touch controls, a measured FPS counter, safe timer cleanup, display power handling and wider obstacle spacing.

The full license is included here and installed as `dinorun.license`. The app keeps the watch's global graphics object and saved theme intact. Its playfield uses black pixels on white for the original T-Rex appearance.
