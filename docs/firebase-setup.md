# Turning on reader accounts (Firebase, free)

Reader accounts (sign-in, profiles, synced reading progress, public profiles) run on **Google Firebase**,
on the free **Spark** plan. Spark never pauses for inactivity and needs no credit card. Until these steps are
done, the site still counts reading in each visitor's browser; it just has no sign-in.

About 10–15 minutes. Do it from the **journal's own Google account** so future boards keep access.

## 1. Create the project
1. Go to <https://console.firebase.google.com> signed in as the journal's Google account.
2. **Create a project** → name it `wvsu-jla` → you can turn Google Analytics **off** → Create.
3. Stay on the **Spark (no-cost)** plan. Don't upgrade.

## 2. Turn on sign-in
1. **Build → Authentication → Get started.**
2. **Sign-in method** tab:
   - **Google** → Enable → choose the journal email as the support email → Save.
   - **Email/Password** → Enable **Email link (passwordless sign-in)** → Save. (Leave the plain password option off.)
3. **Settings → Authorized domains** → **Add domain**:
   - `journalforlawadvocacy.netlify.app`
   - `feature-accounts--journalforlawadvocacy.netlify.app` (the test copy of the site)
4. **Sign-in on the site's own domain** (needed because `authDomain` is `journalforlawadvocacy.netlify.app`, proxied to Firebase in `netlify.toml`): in Google Cloud Console → APIs & Services → Credentials → *OAuth 2.0 Client IDs* → "Web client (auto created by Google Service)", add the Authorized redirect URI `https://journalforlawadvocacy.netlify.app/__/auth/handler` and Save.
   - your custom domain later, if the journal gets one.

## 3. Create the database
1. **Build → Firestore Database → Create database.**
2. Location: **asia-southeast1 (Singapore)** (it can't be changed later).
3. Start in **production mode**.
4. Open the **Rules** tab, delete what's there, paste the whole of [`firebase/firestore.rules`](../firebase/firestore.rules), and **Publish**.

## 4. Connect the website
1. **Project settings** (gear icon) → **General** → *Your apps* → the **Web** icon (`</>`).
2. Nickname `website` → Register app (no Hosting needed).
3. Firebase shows a `firebaseConfig = { … }` block. Copy the values into `src/_data/site.json` as a
   `"firebase"` object, like this (these values are meant to be public; the rules protect the data):

   ```json
   "firebase": {
     "apiKey": "…",
     "authDomain": "wvsu-jla.firebaseapp.com",
     "projectId": "wvsu-jla",
     "appId": "…"
   }
   ```

   (Or send the block to the web admin.) Once it's deployed, **Sign in** appears in *My library*.

## 5. Editors (for comment moderation and submissions, later phases)
To make a board member an editor: have them sign in once, then in **Firestore → Data** create a collection
`editors` with a document whose **ID is their user ID** (Authentication → Users → *User UID*), with any field,
e.g. `name: "Felice Nafarrete"`. Remove the document to take the role away.

## Keeping an eye on it
**Firestore → Usage** shows reads and writes per day. The free plan allows 50,000 reads and 20,000 writes a
day; the site saves progress at most every 20 seconds while someone reads, so a journal's traffic stays far below.
