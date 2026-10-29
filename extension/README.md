# YouFloww New Tab (Chrome extension)

Every new tab becomes a calm focus space: greeting + big clock, today's focus intention, a light focus timer
(25/15/50 min, survives closing the tab, hands off to the full app), search through your default engine,
quick links (add / remove) and a rotating wallpaper painted for YouFloww. Light and dark (follows the system,
or toggle with the moon/sun button). Works offline; nothing is sent anywhere.

- Manifest V3, plain JS + CSS, no remote code, no framework.
- Only permission: `search` (so the search box uses your default engine). Data (intention, links, timer, theme)
  lives in this page's `localStorage` on your computer.
- Tips: press `/` to jump to search; double-click the greeting to set your name.

## Load it unpacked (testing)
1. Open `chrome://extensions`, switch **Developer mode** on.
2. **Load unpacked**, choose this `extension/` folder.
3. Open a new tab. (Chrome may ask once whether to keep the new-tab page; choose Keep it.)

## Build the zip
```
./extension/build.sh        # -> extension/dist/youfloww-newtab-<version>.zip
```

## Publish on the Chrome Web Store
1. Register a developer account at https://chrome.google.com/webstore/devconsole (one-time US$5 fee).
2. **Add new item** and upload the zip from `dist/`.
3. Fill the listing: description (use the intro above), category *Productivity*, language, and at least one
   1280x800 screenshot (or 640x400) of the new tab, plus a 440x280 small promo tile. The 128 px icon is in `icons/`.
4. Privacy tab: single purpose = "replace the new tab page with a focus dashboard"; justify the `search`
   permission ("runs the search box through the user's default search engine"); declare that no user data is
   collected or transmitted; no remote code.
5. Submit for review (typically a few days). Bump `version` in `manifest.json` for every update.

## Hand-off to the full app
The timer's "Continue in the full app" link opens `https://youfloww.vercel.app/?focus=<minutes>&label=<intention>`.
The web app does not read those parameters yet; see `src/features/focusmusic/INTEGRATION.md` for a 10-line hook.

Art: the app's own watercolour scenes (`img/`). Icons are the YouFloww logo.
