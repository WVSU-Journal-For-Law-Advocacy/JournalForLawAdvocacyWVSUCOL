# The WVSU JLA app

The website is also an installable app (a "progressive web app"). There is one codebase: every deploy
updates the website and the app together.

## What readers get (live now)
- **Install:** on Android, Chrome offers *Install app* (the site also invites readers after their second visit,
  or from **My library → App & offline**). On iPhone: Safari → **Share** → **Add to Home Screen**.
  The app opens full screen with the Journal's seal as its icon.
- **Offline reading:** pages a reader has opened are kept on the device. **More → Save for offline** on any article
  keeps it (and its PDF) for good; saved articles are listed in My library and on the offline page.
- **Share into the app:** the app appears in the phone's share menu. A shared Journal link opens that page;
  any other text searches the Journal.
- **Shortcuts:** long-press the app icon for My library, the latest volume, and Search.

Files: `src/manifest.webmanifest.njk`, `src/sw.njk` (the service worker, `/sw.js`), `src/offline.njk`,
the install and save code at the end of `src/assets/js/site.js`, and the icons in `src/assets/img/app/`.

## Next: push notifications (needs two console steps)
1. Firebase console → **Project settings → Cloud Messaging → Web Push certificates → Generate key pair**.
   Send the key to the web admin (it goes in `src/_data/site.json`; it is public).
2. Firebase console → **Project settings → Service accounts → Generate new private key**. This file is **secret**:
   don't email or commit it. In Netlify → **Site configuration → Environment variables**, add
   `FIREBASE_SERVICE_ACCOUNT` and paste the whole file's contents as the value.

## Later: Google Play
Uses PWABuilder.com (no software to install) and a Google Play Console account ($25 one-time, in the
Journal's name). The steps will be written up in `docs/play-store.md` when we get there.
