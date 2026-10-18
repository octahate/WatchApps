# Gellért’s P8 App Store

Personal P8 / MOY-TIN5 app store based on [jeffmer/WatchApps](https://github.com/jeffmer/WatchApps), with Espruino and the regular P8 Main environment.

The catalog is specific to P8, opens without a watch chooser and contains the P8 system components, shared compatible apps, clocks, games and widgets. Device-specific packages for other watches are excluded. The generic Multi Clock uses the P8 touch UI; its upstream device metadata was corrected for this catalog.

## Custom changes

- Hello World 0.02: explicit foreground and background colors, screen wake, touch greeting counter and side-button exit.
- Launcher 0.06: repaints the full screen on every page draw, restores widgets and flushes the display update.
- The site publishes only catalog apps and their referenced files. Original upstream source remains in Git history and the checkout for reference.

## Theme fixes

Main 0.06 applies the saved palette every time apps load and restores it on graphics resets. Settings 0.05 uses the same theme handler. Widget drawing restores colors between widgets; updated battery, alarm and moon widgets work on light backgrounds. Multi Clock 0.09 restores bitmap backgrounds and adapts its Braun dial to the theme.

To apply these fixes to an existing watch, update Main and Setting, then update the installed Launcher, Multi Clock and widgets from My Apps. Reopen the launcher after the updates.

## Clock synchronization

Connect the P8, open About and click Set Time. Enable Set watch time automatically when connecting to sync on future connections. Time zone is copied from the browser device and saved in the P8 settings.json file.

## Development

Clone with `git clone --recurse-submodules https://github.com/octahate/WatchApps.git`.
Run `node tests/personal-apps.cjs`, then `node scripts/build-site.cjs`. The static site is written to `_site/`.

Add apps under `apps/<id>/` with an entry in `apps.json` and `supports: ["P8"]`. List every runtime file in the entry’s `storage` array.

GitHub Pages uses GitHub Actions. The publishing workflow checks out the pinned loader-core submodule, runs verification and builds the P8 site on pushes to `master`.

## Credits

Jeff Magee for WatchApps and its P8 environment; fanoush and ATC1441 for their smartwatch work; Gordon Williams and contributors for Espruino and the app loader. See LICENSE for the upstream MIT license.
