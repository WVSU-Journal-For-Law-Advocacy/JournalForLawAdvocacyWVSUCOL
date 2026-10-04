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

## Notifications (built; switch on with two console steps)
Readers choose in **My library → Notifications**: new volume, replies to my comments, calls for papers, and a
weekly reading reminder (Saturdays 9 AM, only if they haven't read that week). Board members send new-volume and
call-for-papers alerts from **/editor/announce/** (with a "send a test to me" button). Replies are sent automatically.
On iPhone, notifications work once the app is installed (iOS 16.4+).

To switch them on:
1. Firebase console → **Project settings → Cloud Messaging → Web Push certificates → Generate key pair**.
   Copy the **Key pair** value into `src/_data/site.json` → `firebase.vapidKey` (it is public), or send it to the web admin.
2. Firebase console → **Project settings → Service accounts → Generate new private key**. This file is **secret**:
   don't email, message, or commit it. In Netlify → **Site configuration → Environment variables → Add a variable**:
   key `FIREBASE_SERVICE_ACCOUNT`, value = the whole contents of the file, scopes = Functions. Then delete the file.
3. Publish the latest `firebase/firestore.rules` (adds `pushDevices` and `announcements`).
4. Redeploy. The functions are in `netlify/functions/`: `push-reply`, `push-broadcast` (editors only),
   and `push-streak` (scheduled). Their logs are under Netlify → Logs → Functions.

## Later: Google Play
Uses PWABuilder.com (no software to install) and a Google Play Console account ($25 one-time, in the
Journal's name). The steps will be written up in `docs/play-store.md` when we get there.

## The app's look (app mode)

When the Journal runs as the installed app it switches to an app layer (`src/assets/css/app.css`, `src/assets/js/app-shell.js`):
an opening animation, a bottom tab bar (Home · Explore · Search · Library · More), a compact app bar with a back arrow,
slide-in page transitions, and an app Home with book-cover shelves. The website is unchanged.

- **Preview it in any browser:** open `https://wvsujournalforlawadvocacy.netlify.app/?app=1`. Turn it off with `?app=0`.
- **Cover colours** for each area of law are in `src/_data/site.json` → `area_tones`. A new area without a colour gets plum.
- The opening animation plays once each time the app is opened (not on every page), and is skipped for readers who turn on "reduce motion".
