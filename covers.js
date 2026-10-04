// Cover photos for the app's book covers, picked automatically at build time from Unsplash's official API.
//   · An article's photo comes from its own front matter `cover_photo: <Unsplash photo id>` if set; otherwise from the
//     Journal's Firestore (`covers/{key}`), so a cover never changes between builds; otherwise it is searched for
//     (first keyword, portrait, safe content) with the area's chosen photo as a fallback, then saved to Firestore.
//   · Unsplash's terms: photos are shown from Unsplash's servers (never copied), each use is reported once through the
//     photo's download link, and the photographer is credited.
//   · Needs UNSPLASH_ACCESS_KEY (and FIREBASE_SERVICE_ACCOUNT to remember choices) in Netlify's environment.
//     Without them, or if anything fails, covers simply stay plain; the build never fails because of a photo.

const API = "https://api.unsplash.com";
const APP = "wvsu_journal_for_law_advocacy"; // for Unsplash's referral links
const MAX_NEW = 20; // new searches per build (Unsplash's demo limit is 50 requests an hour)

// one carefully chosen photo per area of law, used when a keyword search finds nothing good
export const AREA_PHOTOS = {
  "Constitutional law": "zrqng7CAdQM",            // the Philippine flag over an old stone structure
  "Privacy and data protection": "a40akJxBhT8",   // a pole of surveillance cameras
  "Technology and the law": "CANL3bzp6wU",        // a gold-traced circuit board
  "Election law": "QpdNe6njPlw",                  // voting booths
  "Criminal law": "5HzOtV-FSlw",                  // handcuffs
  "Environmental law": "1CiE1x4dHIY",             // mangrove roots in dark water
  "Civil law": "9i5eqBarv-k",                     // a hand signing a form
  "Taxation": "OtfnlTw0lH4",                      // gold coins
  "Legal ethics and the profession": "L4YGuSg0fxs", // a Lady Justice figurine
};
export const VOLUME_PHOTO = "lCkHnqTnjXw";         // classical columns in strong shadow

const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const slim = (p, query) => ({
  id: p.id, raw: p.urls.raw, by: p.user.name, byUrl: `${p.user.links.html}?utm_source=${APP}&utm_medium=referral`,
  link: `${p.links.html}?utm_source=${APP}&utm_medium=referral`, color: p.color || "", query: query || "", at: Date.now(),
});
// the picture as the covers use it: small, greyscale, cropped to a book's shape
export const coverSrc = (c, w = 420) => (c && c.raw ? `${c.raw}&w=${w}&q=60&fm=jpg&fit=crop&ar=2:3&sat=-100` : "");

async function firestore() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) return null;
  try {
    const { initializeApp, cert, getApps } = await import("firebase-admin/app");
    const { getFirestore } = await import("firebase-admin/firestore");
    const app = getApps()[0] || initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
    return getFirestore(app);
  } catch (e) { console.warn("[covers] Firestore unavailable:", e.message); return null; }
}

export async function pickCovers({ articles = [], issues = [] }) {
  const out = {};
  const key = process.env.UNSPLASH_ACCESS_KEY;
  const db = await firestore();
  const items = [
    ...articles.map((a) => ({ key: `article_${a.slug}`, slug: a.slug, pin: a.cover_photo, query: (a.keywords || [])[0], fallback: AREA_PHOTOS[a.area] })),
    ...issues.map((i) => ({ key: `volume_${i.volume}`, slug: `volume-${i.volume}`, pin: i.cover_photo, query: "", fallback: VOLUME_PHOTO })),
  ];

  // what was chosen before
  const saved = {};
  if (db) {
    try { (await db.collection("covers").get()).forEach((d) => { saved[d.id] = d.data(); }); }
    catch (e) { console.warn("[covers] could not read saved covers:", e.message); }
  }
  for (const it of items) if (saved[it.key] && (!it.pin || saved[it.key].id === it.pin)) out[it.slug] = saved[it.key];
  if (!key) { if (items.some((it) => !out[it.slug])) console.log("[covers] UNSPLASH_ACCESS_KEY not set: new covers stay plain"); return out; }

  const get = async (path) => {
    const r = await fetch(API + path, { headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" } });
    if (!r.ok) throw new Error(`Unsplash ${r.status}`);
    return r.json();
  };
  const used = new Set(Object.values(out).map((c) => c.id));
  let fresh = 0;
  for (const it of items) {
    if (out[it.slug] || fresh >= MAX_NEW) continue;
    try {
      let photo = null;
      if (it.pin) photo = await get(`/photos/${encodeURIComponent(it.pin)}`);
      if (!photo && it.query) {
        const res = await get(`/search/photos?query=${encodeURIComponent(it.query)}&orientation=portrait&content_filter=high&per_page=10`);
        const pool = (res.results || []).filter((p) => !used.has(p.id)).slice(0, 5);
        if (pool.length >= 2) photo = pool[hash(it.slug) % pool.length]; // a little variety, the same pick for the same results
      }
      if (!photo && it.fallback) photo = await get(`/photos/${it.fallback}`);
      if (!photo) continue;
      fresh++;
      const c = slim(photo, it.pin ? "pinned" : it.query);
      out[it.slug] = c; used.add(c.id);
      // Unsplash asks to be told once when a photo is put to use
      if (photo.links && photo.links.download_location) fetch(photo.links.download_location, { headers: { Authorization: `Client-ID ${key}` } }).catch(() => {});
      if (db) await db.collection("covers").doc(it.key).set(c).catch((e) => console.warn("[covers] could not save", it.key, e.message));
    } catch (e) { console.warn(`[covers] ${it.slug}: ${e.message}`); if (/403|429/.test(e.message)) break; } // over the hourly limit: try again next build
  }
  if (fresh) console.log(`[covers] picked ${fresh} new cover photo(s)`);
  return out;
}
