# Gellért’s P8 App Store

Personal fork of [jeffmer/WatchApps](https://github.com/jeffmer/WatchApps). All original applications and device drivers are retained.

## Personal additions

- **Hello World**: tap to increase the greeting count; press the side button to return to the launcher.
- **Launcher 0.04**: clears startup text before drawing widgets and icons on P8, ROCK and Magic3.

On your already configured P8, install or update **Launcher (Default)** and install **Hello World**. Keep the regular **Main** environment.

## Publishing and development

GitHub Pages should use **GitHub Actions** as its source. The Publish app store workflow checks out the pinned loader-core submodule, verifies the changes and publishes the static site on every push to `master`.

Clone with `git clone --recurse-submodules https://github.com/octahate/WatchApps.git`. Run `node tests/personal-apps.cjs` to validate the custom app and launcher. New apps live under `apps/<id>/` and have an entry in `apps.json`.

## Upstream documentation

Espruino App Loader (and Apps) for  P8, ROCK, Magic 3 Smart Watches
==============================

## Installation

### ROCK and Magic3
For a brand-new watch, you need to follow the instructions [here](https://github.com/fanoush/ds-d6/tree/master/espruino/DFU/Magic3) produced by @fanoush. Also following these instructions downgrade to SoftDevice S140-6.0.0.  After that you can flash the zip file from the firmware [directory](https://github.com/jeffmer/WatchApps/tree/main/firmware).  

IMPORTANT - you need to downgrade the SoftDevice before loading my Espruino zip file. The sequence is is this: install 1) Espruino using DaFlasher 2) DFU bootloader using WEBIDE  3)  Espruino zip file from fanoush repository 4) downgrade SoftDevice to 6.0.0 5) Espruino zip in this repository. Miss any of these steps results in a temporary (wait for battery flat) or permanent brick.

This build has a modified `lcd_spi_unbuf` module. The build makes the full 8 megabytes available to Espruino applications. 

### P8
For a brand-new P8, you need to follow the instructions [here](https://github.com/fanoush/ds-d6/tree/master/espruino/DFU/P8) produced by @fanoush to get the right bootloader required by Espruino - SDK12 with Softdevice S132 3.0. After that you can flash the zip file from the firmware [directory](https://github.com/jeffmer/WatchApps/tree/main/firmware).

This build has a modified `lcd_spi_unbuf` module that works with SPI FLASH. The build makes the full 4 megabytes available to Espruino applications. 

________________________________________________________

Once Espruino is installed use the [App Loader](https://jeffmer.github.io/WatchApps/) to load `Bootloader`, `Main`, `Launcher` and `Settings` followed by the apps and widgets you want.

These provide a simple Bangle emulation environment which will let you load Bangle Apps from its App Loader. 

![img](img/rock_pic.jpeg)

Note: If you want to connect GadgetBridge from an Android phone load the **Android Integration** and **Messages** apps from the official **BangleApps** loader.

### Credits

@ATC1441, reverse engineered the DaFit app and wrote [DaFlasher](https://play.google.com/store/apps/details?id=com.atcnetz.paatc.patc&gl=US) which allows you to replace the firmware these watches come with.

@Fanoush, for the Espruino builds/bootloaders and his help with getting the LCD driver to work.

@gfwilliams, for [Espruino](https://www.espruino.com/) and for the Bangle App Loader used here. *If you want a hassle free watch you can program off the shelf get a Bangle.js or Bangle.js2.*


