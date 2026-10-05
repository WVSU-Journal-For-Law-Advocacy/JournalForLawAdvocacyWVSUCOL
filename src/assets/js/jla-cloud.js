/* Reader accounts, the Firebase side (Auth + Firestore on the free Spark plan).
   The SDK is loaded from Google's CDN only when this module is first used. The web config
   comes from site.json ("firebase") via <script id="fb-config">; it is public by design,
   and the Firestore security rules (firebase/firestore.rules) decide who may read or write what. */

import { local, mergeAll, mergeWeeks } from './jla-core.js';

const V = '10.14.1', CDN = `https://www.gstatic.com/firebasejs/${V}`;
const cfgEl = document.getElementById('fb-config');
export const config = cfgEl ? JSON.parse(cfgEl.textContent || 'null') : null;
export const enabled = !!(config && config.apiKey && config.projectId);

let sdk;
async function load() {
  if (!enabled) throw new Error('Accounts are not set up yet');
  if (sdk) return sdk;
  sdk = (async () => {
    const [app, auth, fs] = await Promise.all([import(`${CDN}/firebase-app.js`), import(`${CDN}/firebase-auth.js`), import(`${CDN}/firebase-firestore.js`)]);
    const a = app.initializeApp(config);
    return { app: a, A: auth, F: fs, auth: auth.getAuth(a), db: fs.getFirestore(a) };
  })();
  return sdk;
}

/* ---------- who is signed in ---------- */
let current; const waiters = [];
export async function onUser(cb) {
  const s = await load();
  s.A.onAuthStateChanged(s.auth, async (u) => {
    current = u || null; editorP = null;
    if (u) {
      const me = await getProfile(u.uid).catch(() => null);
      // remember editors on this device so every page can show the Board menu without loading Firebase
      const ed = await s.F.getDoc(s.F.doc(s.db, 'editors', u.uid)).then((d) => d.exists()).catch(() => false);
      local.setMe({ uid: u.uid, name: (me && me.name) || u.displayName || 'Reader', photo: (me && me.photo) || u.photoURL || '', editor: ed });
    }
    else local.setMe(null);
    cb(current);
    waiters.splice(0).forEach((w) => w(current));
  });
}
export const user = () => current;

/* ---------- signing in ---------- */
export async function signInGoogle() {
  const s = await load(); const p = new s.A.GoogleAuthProvider();
  try { return await s.A.signInWithPopup(s.auth, p); }
  catch (e) {
    // some phone browsers block the pop-up: go to Google and come back instead (works now that auth runs on our domain)
    if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment', 'auth/cancelled-popup-request'].includes(e.code)) return s.A.signInWithRedirect(s.auth, p);
    throw e;
  }
}
// coming back from Google's sign-in page (the redirect fallback): surfaces its error, if any
export async function redirectResult() { const s = await load(); return s.A.getRedirectResult(s.auth); }
// is this address an email sign-in link?
export async function isEmailLink() { const s = await load(); return s.A.isSignInWithEmailLink(s.auth, location.href); }
// Messenger, Facebook, Instagram and other in-app browsers: Google does not allow signing in inside them
export const inAppBrowser = () => {
  const ua = navigator.userAgent || '';
  if (/Orca|MessengerForiOS|MessengerLite/i.test(ua)) return 'Messenger';
  if (/FBAN|FBAV|FB_IAB|FBIOS|Messenger|Instagram|Line\/|MicroMessenger|TikTok|Snapchat|Twitter/i.test(ua)) return (ua.match(/Messenger|Instagram|Line|MicroMessenger|TikTok|Snapchat|Twitter/i) || ['Facebook'])[0].replace('MicroMessenger', 'WeChat');
  return '';
};
export async function sendEmailLink(email, returnTo) {
  const s = await load();
  await s.A.sendSignInLinkToEmail(s.auth, email, { url: returnTo, handleCodeInApp: true });
  try { localStorage.setItem('jla:email', email); } catch (e) {}
}
export async function finishEmailLink(askEmail) {
  const s = await load();
  if (!s.A.isSignInWithEmailLink(s.auth, location.href)) return null;
  let email = null; try { email = localStorage.getItem('jla:email'); } catch (e) {}
  if (!email) email = await askEmail();
  if (!email) return null;
  const res = await s.A.signInWithEmailLink(s.auth, email, location.href);
  try { localStorage.removeItem('jla:email'); } catch (e) {}
  history.replaceState(null, '', location.pathname);
  return res;
}
export async function signOut() {
  const s = await load();
  // this device stops getting this reader's notifications
  try { const st = JSON.parse(localStorage.getItem('jla:push') || 'null'); if (st && st.id) await s.F.deleteDoc(s.F.doc(s.db, 'pushDevices', st.id)); } catch (e) {}
  localStorage.removeItem('jla:push');
  await s.A.signOut(s.auth); local.setMe(null);
}

/* ---------- profile ---------- */
const PROFILE = ['name', 'bio', 'school', 'photo', 'thumb', 'public', 'joined', 'badges', 'weeks', 'stats', 'consent', 'prefs', 'follows'];
export async function getProfile(uid) {
  const s = await load(); const snap = await s.F.getDoc(s.F.doc(s.db, 'users', uid));
  return snap.exists() ? snap.data() : null;
}
export async function saveProfile(fields) {
  const s = await load(); const u = current; if (!u) throw new Error('Not signed in');
  const clean = Object.fromEntries(Object.entries(fields).filter(([k]) => PROFILE.includes(k)));
  await s.F.setDoc(s.F.doc(s.db, 'users', u.uid), clean, { merge: true });
  const me = local.me() || {}; local.setMe({ ...me, uid: u.uid, name: clean.name ?? me.name, photo: clean.photo ?? me.photo });
}

/* ---------- progress ---------- */
export async function loadProgress() {
  const s = await load(); const u = current; if (!u) return {};
  const snap = await s.F.getDocs(s.F.collection(s.db, 'users', u.uid, 'progress'));
  const out = {}; snap.forEach((d) => { out[d.id] = d.data(); }); return out;
}
export async function saveProgress(slug, p) {
  const s = await load(); const u = current; if (!u) return;
  const rec = { read: (p.read || []).slice(0, 3000), pct: Math.min(100, Math.max(0, Math.round(p.pct || 0))), done: !!p.done,
    doneAt: p.doneAt || null, self: !!p.self, words: p.words || 0, at: p.at || null, updated: Date.now() };
  await s.F.setDoc(s.F.doc(s.db, 'users', u.uid, 'progress', slug), rec);
}
// on sign-in: merge what this browser has with what the account has, and save the union both ways
export async function sync() {
  const u = current; if (!u) return null;
  const [remote, profile] = await Promise.all([loadProgress(), getProfile(u.uid)]);
  const mine = local.all(), merged = mergeAll(remote, mine);
  local.replaceAll(merged);
  const weeks = mergeWeeks((profile && profile.weeks) || {}, local.weeks());
  local.setWeeks(weeks);
  const changed = Object.entries(merged).filter(([k, v]) => JSON.stringify({ ...v, updated: 0 }) !== JSON.stringify({ ...(remote[k] || {}), updated: 0 }));
  await Promise.all(changed.map(([k, v]) => saveProgress(k, v)));
  return { progress: merged, weeks, profile };
}

/* ---------- highlights & notes (private to the reader) ---------- */
const hlCol = (s, uid) => s.F.collection(s.db, 'users', uid, 'highlights');
export async function loadHighlights(slug) {
  const s = await load(); const u = current; if (!u) return [];
  const q = slug ? s.F.query(hlCol(s, u.uid), s.F.where('slug', '==', slug)) : hlCol(s, u.uid);
  const snap = await s.F.getDocs(q); const out = []; snap.forEach((d) => out.push({ id: d.id, ...d.data() }));
  return out.sort((a, b) => (a.created || 0) - (b.created || 0));
}
export async function addHighlight(h) {
  const s = await load(); const u = current; if (!u) throw new Error('Not signed in');
  const ref = await s.F.addDoc(hlCol(s, u.uid), { slug: h.slug, pid: h.pid, text: String(h.text).slice(0, 500), note: String(h.note || '').slice(0, 1000), created: Date.now() });
  return ref.id;
}
export async function updateHighlight(id, fields) {
  const s = await load(); const u = current; if (!u) return;
  await s.F.updateDoc(s.F.doc(s.db, 'users', u.uid, 'highlights', id), { note: String(fields.note || '').slice(0, 1000) });
}
export async function deleteHighlight(id) {
  const s = await load(); const u = current; if (!u) return;
  await s.F.deleteDoc(s.F.doc(s.db, 'users', u.uid, 'highlights', id));
}

/* ---------- paragraph comments ---------- */
// bubble counts for one article: a single public read over plain HTTPS (no SDK needed)
export async function threadCounts(slug) {
  if (!enabled) return {};
  const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/threads/${encodeURIComponent(slug)}?key=${config.apiKey}`;
  const r = await fetch(url); if (!r.ok) return {};
  const j = await r.json(); const f = (((j.fields || {}).counts || {}).mapValue || {}).fields || {};
  return Object.fromEntries(Object.entries(f).map(([k, v]) => [k, Number(v.integerValue || v.doubleValue || 0)]));
}
export async function loadComments(slug, pid, { editor = false } = {}) {
  const s = await load(); const col = s.F.collection(s.db, 'comments');
  const q = editor ? s.F.query(col, s.F.where('slug', '==', slug), s.F.where('pid', '==', pid))
    : s.F.query(col, s.F.where('slug', '==', slug), s.F.where('pid', '==', pid), s.F.where('hidden', '==', false));
  const snap = await s.F.getDocs(q); const out = [];
  snap.forEach((d) => { const x = d.data(); out.push({ id: d.id, ...x, created: x.created && x.created.toMillis ? x.created.toMillis() : Date.now() }); });
  return out;
}
const bump = (s, slug, pid, n) => s.F.setDoc(s.F.doc(s.db, 'threads', slug), { counts: { [pid]: s.F.increment(n) } }, { merge: true });
export async function addComment({ slug, pid, text, parent = null, name, thumb = '' }) {
  const s = await load(); const u = current; if (!u) throw new Error('Not signed in');
  const ref = await s.F.addDoc(s.F.collection(s.db, 'comments'), {
    slug, pid, uid: u.uid, name: String(name || 'Reader').slice(0, 80), thumb: String(thumb || '').slice(0, 8000),
    text: String(text).trim().slice(0, 1000), parent, created: s.F.serverTimestamp(), hidden: false, likedBy: [],
  });
  await bump(s, slug, pid, 1).catch(() => {});
  return ref.id;
}
export async function toggleLike(id, liked) {
  const s = await load(); const u = current; if (!u) throw new Error('Not signed in');
  await s.F.updateDoc(s.F.doc(s.db, 'comments', id), { likedBy: liked ? s.F.arrayUnion(u.uid) : s.F.arrayRemove(u.uid) });
}
export async function deleteComment(c) {
  const s = await load(); await s.F.deleteDoc(s.F.doc(s.db, 'comments', c.id));
  if (!c.hidden) await bump(s, c.slug, c.pid, -1).catch(() => {});
}
export async function setHidden(c, hidden) {
  const s = await load(); await s.F.updateDoc(s.F.doc(s.db, 'comments', c.id), { hidden });
  await bump(s, c.slug, c.pid, hidden ? -1 : 1).catch(() => {});
}
export async function reportComment(c, reason) {
  const s = await load(); const u = current; if (!u) throw new Error('Not signed in');
  // one report per reader per comment (reporting twice is quietly ignored)
  try {
    await s.F.setDoc(s.F.doc(s.db, 'reports', `${c.id}_${u.uid}`), { commentId: c.id, slug: c.slug, pid: c.pid, uid: u.uid, reason: String(reason || '').slice(0, 300), created: s.F.serverTimestamp() });
  } catch (e) { return; }
  // tells the editors, and hides the comment once three readers have reported it
  callFunction('comment-report', { commentId: c.id }).catch(() => {});
}
let editorP;
export function isEditor() {
  const u = current; if (!u) return Promise.resolve(false);
  return editorP || (editorP = load().then((s) => s.F.getDoc(s.F.doc(s.db, 'editors', u.uid))).then((d) => d.exists()).catch(() => false));
}
// is this reader muted (can't post)? returns the mute or null
export async function myMute() {
  const s = await load(); const u = current; if (!u) return null;
  const d = await s.F.getDoc(s.F.doc(s.db, 'mutes', u.uid)).catch(() => null);
  if (!d || !d.exists()) return null;
  const m = d.data(); return m.until && m.until < Date.now() ? null : m;
}

/* ---------- moderation (editors only; the rules check again) ---------- */
const ms = (t) => (t && t.toMillis ? t.toMillis() : +t || 0);
const rows = (snap) => { const out = []; snap.forEach((d) => { const x = d.data(); out.push({ id: d.id, ...x, created: ms(x.created), at: ms(x.at) }); }); return out; };
export async function modReports() {
  const s = await load();
  return rows(await s.F.getDocs(s.F.query(s.F.collection(s.db, 'reports'), s.F.orderBy('created', 'desc'), s.F.limit(300))));
}
export async function modComment(id) {
  const s = await load(); const d = await s.F.getDoc(s.F.doc(s.db, 'comments', id));
  if (!d.exists()) return null; const x = d.data(); return { id: d.id, ...x, created: ms(x.created) };
}
export async function modRecent(n = 60) {
  const s = await load();
  return rows(await s.F.getDocs(s.F.query(s.F.collection(s.db, 'comments'), s.F.orderBy('created', 'desc'), s.F.limit(n))));
}
export async function modHidden() {
  const s = await load();
  return rows(await s.F.getDocs(s.F.query(s.F.collection(s.db, 'comments'), s.F.where('hidden', '==', true), s.F.limit(200)))).sort((a, b) => b.created - a.created);
}
export async function modByReader(uid) {
  const s = await load();
  return rows(await s.F.getDocs(s.F.query(s.F.collection(s.db, 'comments'), s.F.where('uid', '==', uid), s.F.limit(200)))).sort((a, b) => b.created - a.created);
}
export async function modMutes() {
  const s = await load(); return rows(await s.F.getDocs(s.F.collection(s.db, 'mutes'))).sort((a, b) => b.at - a.at);
}
export async function modLog(n = 80) {
  const s = await load();
  return rows(await s.F.getDocs(s.F.query(s.F.collection(s.db, 'modlog'), s.F.orderBy('at', 'desc'), s.F.limit(n))));
}
async function logAction(s, b, action, c, note = '') {
  const u = current;
  b.set(s.F.doc(s.F.collection(s.db, 'modlog')), {
    action, by: u.uid, byName: (local.me() && local.me().name) || u.displayName || 'Editor', at: s.F.serverTimestamp(), note: String(note || '').slice(0, 300),
    commentId: (c && c.commentId) || (c && c.id) || '', slug: (c && c.slug) || '', pid: (c && c.pid) || '',
    target: (c && c.uid) || '', targetName: String((c && c.name) || '').slice(0, 80), text: String((c && c.text) || '').slice(0, 300),
  });
}
const clearReports = async (s, b, commentId) => (await s.F.getDocs(s.F.query(s.F.collection(s.db, 'reports'), s.F.where('commentId', '==', commentId)))).forEach((d) => b.delete(d.ref));
// hide or restore; restoring also clears its reports (an editor looked and it's fine)
export async function modSetHidden(c, hidden, note = '') {
  const s = await load(); const b = s.F.writeBatch(s.db);
  b.update(s.F.doc(s.db, 'comments', c.id), { hidden });
  if (!hidden) await clearReports(s, b, c.id);
  await logAction(s, b, hidden ? 'hide' : 'restore', c, note);
  await b.commit();
  await bump(s, c.slug, c.pid, hidden ? -1 : 1).catch(() => {});
}
// delete a comment with its replies and reports
export async function modDelete(c, note = '') {
  const s = await load(); const b = s.F.writeBatch(s.db);
  const replies = rows(await s.F.getDocs(s.F.query(s.F.collection(s.db, 'comments'), s.F.where('parent', '==', c.id))));
  [c, ...replies].forEach((x) => b.delete(s.F.doc(s.db, 'comments', x.id)));
  await clearReports(s, b, c.id);
  await logAction(s, b, 'delete', c, note || (replies.length ? `with ${replies.length} repl${replies.length > 1 ? 'ies' : 'y'}` : ''));
  await b.commit();
  const visible = [c, ...replies].filter((x) => !x.hidden).length;
  if (visible) await bump(s, c.slug, c.pid, -visible).catch(() => {});
}
// reports on a comment that no longer exists
export async function modDropReports(commentId) {
  const s = await load(); const b = s.F.writeBatch(s.db); await clearReports(s, b, commentId); await b.commit();
}
// keep the comment, close its reports
export async function modDismiss(c, note = '') {
  const s = await load(); const b = s.F.writeBatch(s.db);
  await clearReports(s, b, c.id); await logAction(s, b, 'dismiss', c, note); await b.commit();
}
// mute a reader: they can still read, but not post. days = 0 means until an editor unmutes them
export async function modMute(c, days, reason = '') {
  const s = await load(); const u = current; const b = s.F.writeBatch(s.db);
  b.set(s.F.doc(s.db, 'mutes', c.uid), { name: String(c.name || 'Reader').slice(0, 80), reason: String(reason || '').slice(0, 300), by: u.uid, at: s.F.serverTimestamp(), until: days ? Date.now() + days * 864e5 : 0 });
  await logAction(s, b, 'mute', c, `${days ? `${days} days` : 'until unmuted'}${reason ? `: ${reason}` : ''}`);
  await b.commit();
}
export async function modUnmute(m) {
  const s = await load(); const b = s.F.writeBatch(s.db);
  b.delete(s.F.doc(s.db, 'mutes', m.id));
  await logAction(s, b, 'unmute', { uid: m.id, name: m.name });
  await b.commit();
}

/* ---------- notifications (Firebase Cloud Messaging, opt-in) ---------- */
export const pushConfigured = () => enabled && !!config.vapidKey;
export async function idToken() { const u = current; return u ? u.getIdToken() : null; }
// why notifications can't work here, or '' if they can
export function pushBlocker() {
  if (!pushConfigured()) return 'Notifications are not switched on yet.';
  if (/iPhone|iPad|iPod/.test(navigator.userAgent) && !(window.matchMedia('(display-mode: standalone)').matches || navigator.standalone)) return 'On iPhone, install the app first (Safari → Share → Add to Home Screen), then turn these on from the app.';
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return "This browser can't show notifications.";
  if (Notification.permission === 'denied') return 'Notifications are blocked for this site. Allow them in your browser or phone settings, then try again.';
  return '';
}
const sha = async (t) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)))].map((b) => b.toString(16).padStart(2, '0')).join('');
const PUSH = 'jla:push';
export const pushState = () => { try { return JSON.parse(localStorage.getItem(PUSH) || 'null'); } catch (e) { return null; } };
// turn notifications on for these topics (asks the browser for permission the first time)
export async function setPushTopics(topics) {
  const s = await load(); const u = current; if (!u) throw new Error('Not signed in');
  const docs = s.F;
  if (!topics.length) {
    const st = pushState(); if (st && st.id) await docs.deleteDoc(docs.doc(s.db, 'pushDevices', st.id)).catch(() => {});
    localStorage.removeItem(PUSH); return null;
  }
  if (Notification.permission !== 'granted' && (await Notification.requestPermission()) !== 'granted') throw new Error('permission');
  const M = await import(`${CDN}/firebase-messaging.js`);
  if (!(await M.isSupported())) throw new Error('unsupported');
  const reg = await navigator.serviceWorker.ready;
  const token = await M.getToken(M.getMessaging(s.app), { vapidKey: config.vapidKey, serviceWorkerRegistration: reg });
  const id = await sha(token);
  const platform = /Android/i.test(navigator.userAgent) ? 'android' : /iPhone|iPad/i.test(navigator.userAgent) ? 'ios' : 'desktop';
  await docs.setDoc(docs.doc(s.db, 'pushDevices', id), { uid: u.uid, token, topics, platform, updated: Date.now() });
  const st = { id, topics }; localStorage.setItem(PUSH, JSON.stringify(st)); return st;
}
// ask a Netlify function to do something that needs the server (send a reply alert, a board announcement)
export async function callFunction(name, body) {
  const t = await idToken(); if (!t) throw new Error('Not signed in');
  const r = await fetch(`/.netlify/functions/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`); return j;
}

/* ---------- author pages: claims (reviewed by editors) and the author's own profile ---------- */
const AUTHOR_FIELDS = ['bio', 'photo', 'affiliation', 'linkedin', 'orcid', 'facebook', 'website'];
// an author page's verified profile: one public read over HTTPS, no SDK needed
export async function authorDoc(slug) {
  if (!enabled) return null;
  const r = await fetch(`https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/authors/${encodeURIComponent(slug)}?key=${config.apiKey}`);
  if (!r.ok) return null;
  const f = (await r.json()).fields || {};
  return Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.stringValue ?? v.booleanValue ?? v.integerValue ?? '']));
}
export async function submitClaim(slug, authorName, note) {
  const s = await load(); const u = current; if (!u) throw new Error('Not signed in');
  await s.F.addDoc(s.F.collection(s.db, 'authorClaims'), {
    slug, authorName: String(authorName).slice(0, 120), uid: u.uid, email: u.email || '', accountName: String(u.displayName || '').slice(0, 80),
    note: String(note || '').trim().slice(0, 600), status: 'pending', created: s.F.serverTimestamp(),
  });
}
export async function myClaims() {
  const s = await load(); const u = current; if (!u) return [];
  const snap = await s.F.getDocs(s.F.query(s.F.collection(s.db, 'authorClaims'), s.F.where('uid', '==', u.uid)));
  const out = []; snap.forEach((d) => out.push({ id: d.id, ...d.data() })); return out;
}
export async function myAuthorPages() {
  const s = await load(); const u = current; if (!u) return [];
  const snap = await s.F.getDocs(s.F.query(s.F.collection(s.db, 'authors'), s.F.where('uid', '==', u.uid)));
  const out = []; snap.forEach((d) => out.push({ slug: d.id, ...d.data() })); return out;
}
export async function saveAuthorProfile(slug, fields) {
  const s = await load(); const u = current; if (!u) throw new Error('Not signed in');
  const clean = Object.fromEntries(Object.entries(fields).filter(([k]) => AUTHOR_FIELDS.includes(k)).map(([k, v]) => [k, String(v || '').trim()]));
  await s.F.updateDoc(s.F.doc(s.db, 'authors', slug), { ...clean, updated: Date.now() });
}
// one profile, no duplicates: an author page shows its author's own profile photo, bio, and school or office.
// Called after the profile changes and whenever My library opens; writes only what differs.
export async function syncAuthorPages(profile) {
  const pages = await myAuthorPages(); if (!pages.length || !profile) return 0;
  const want = { photo: String(profile.photo || ''), bio: String(profile.bio || '').slice(0, 800), affiliation: String(profile.school || '').slice(0, 120) };
  let n = 0;
  for (const p of pages) {
    const diff = Object.fromEntries(Object.entries(want).filter(([k, v]) => (p[k] || '') !== v));
    if (Object.keys(diff).length) { await saveAuthorProfile(p.slug, diff); n++; }
  }
  return n;
}
// a personal invitation link from the board: redeemed on the server, it links this account to the author page at once
export async function redeemInvite(token) { return callFunction('redeem-invite', { token }); }

/* ---------- board outreach: invite past authors to claim their pages, and keep track ---------- */
const randomToken = () => { const b = new Uint8Array(15); crypto.getRandomValues(b); return [...b].map((x) => 'abcdefghijkmnpqrstuvwxyz23456789'[x % 32]).join(''); };
export async function outreachState() {
  const s = await load();
  const [a, o, i] = await Promise.all([s.F.getDocs(s.F.collection(s.db, 'authors')), s.F.getDocs(s.F.collection(s.db, 'outreach')), s.F.getDocs(s.F.query(s.F.collection(s.db, 'invites'), s.F.where('status', '==', 'open')))]);
  const authors = {}, outreach = {}, invites = {};
  a.forEach((d) => { authors[d.id] = d.data(); });
  o.forEach((d) => { const x = d.data(); outreach[d.id] = { ...x, at: x.at && x.at.toMillis ? x.at.toMillis() : x.at || 0 }; });
  i.forEach((d) => { const x = d.data(); if (!x.expires || x.expires > Date.now()) invites[x.slug] = { token: d.id, ...x }; });
  return { authors, outreach, invites };
}
// an open invitation for this author (reused if one exists, so a link sent once keeps working)
export async function inviteFor(slug, authorName) {
  const s = await load(); const u = current; if (!u) throw new Error('Not signed in');
  const open = await s.F.getDocs(s.F.query(s.F.collection(s.db, 'invites'), s.F.where('slug', '==', slug), s.F.where('status', '==', 'open')));
  let found = null; open.forEach((d) => { const x = d.data(); if (!found && (!x.expires || x.expires > Date.now())) found = { token: d.id, ...x }; });
  if (found) return found;
  const token = randomToken(), inv = { slug, authorName: String(authorName).slice(0, 120), createdBy: u.uid, createdByName: (local.me() && local.me().name) || u.displayName || 'Editor', created: s.F.serverTimestamp(), status: 'open', expires: Date.now() + 90 * 864e5 };
  await s.F.setDoc(s.F.doc(s.db, 'invites', token), inv);
  return { token, ...inv };
}
export async function markContacted(slug, { channel, audience = '', note = '', token = '' }) {
  const s = await load(); const u = current; if (!u) throw new Error('Not signed in');
  await s.F.setDoc(s.F.doc(s.db, 'outreach', slug), { status: 'contacted', channel: String(channel).slice(0, 20), audience: String(audience).slice(0, 20), note: String(note).slice(0, 300), token, by: u.uid,
    byName: (local.me() && local.me().name) || u.displayName || 'Editor', at: s.F.serverTimestamp() }, { merge: true });
}
export async function revokeInvite(token) { const s = await load(); await s.F.updateDoc(s.F.doc(s.db, 'invites', token), { status: 'revoked' }); }

/* ---------- proofreading (board): corrections proposed paragraph by paragraph, and where each piece stands ---------- */
const editorName = (u) => (local.me() && local.me().name) || u.displayName || 'Editor';
const millis = (t) => (t && t.toMillis ? t.toMillis() : t || 0);
export async function proposeCorrection(slug, pid, original, proposed, note = '') {
  const s = await load(); const u = current; if (!u) throw new Error('Not signed in');
  await s.F.addDoc(s.F.collection(s.db, 'corrections'), { slug, pid: String(pid).slice(0, 20), original: String(original).slice(0, 6000), proposed: String(proposed).slice(0, 6000),
    note: String(note).slice(0, 500), by: u.uid, byName: editorName(u), at: s.F.serverTimestamp(), status: 'open' });
}
// all corrections (optionally for one piece), newest first
export async function corrections(slug) {
  const s = await load(); const c = s.F.collection(s.db, 'corrections');
  const snap = await s.F.getDocs(slug ? s.F.query(c, s.F.where('slug', '==', slug)) : c);
  const out = []; snap.forEach((d) => { const x = d.data(); out.push({ id: d.id, ...x, at: millis(x.at) }); });
  return out.sort((a, b) => b.at - a.at);
}
export async function setCorrection(id, status) {
  const s = await load(); const u = current; if (!u) throw new Error('Not signed in');
  await s.F.updateDoc(s.F.doc(s.db, 'corrections', id), { status, doneBy: u.uid, doneByName: editorName(u), doneAt: Date.now() });
}
export async function proofState() {
  const s = await load(); const snap = await s.F.getDocs(s.F.collection(s.db, 'proofread'));
  const out = {}; snap.forEach((d) => { const x = d.data(); out[d.id] = { ...x, at: millis(x.at) }; }); return out;
}
// status: 'in-progress' (an editor is on it), 'done' (proofread; the notice on the page goes away), or '' (back in the queue)
export async function setProofread(slug, status) {
  const s = await load(); const u = current; if (!u) throw new Error('Not signed in');
  await s.F.setDoc(s.F.doc(s.db, 'proofread', slug), { status, by: u.uid, byName: editorName(u), at: s.F.serverTimestamp() });
}

// editors: review claims
export async function pendingClaims() {
  const s = await load();
  const snap = await s.F.getDocs(s.F.query(s.F.collection(s.db, 'authorClaims'), s.F.where('status', '==', 'pending')));
  const out = []; snap.forEach((d) => { const x = d.data(); out.push({ id: d.id, ...x, created: x.created && x.created.toMillis ? x.created.toMillis() : 0 }); });
  return out.sort((a, b) => a.created - b.created);
}
export async function decideClaim(claim, approve, note = '') {
  const s = await load(); const u = current; if (!u) throw new Error('Not signed in');
  const batch = s.F.writeBatch(s.db);
  if (approve) batch.set(s.F.doc(s.db, 'authors', claim.slug), { uid: claim.uid, name: claim.authorName, approvedBy: u.uid, approvedAt: Date.now() }, { merge: true });
  batch.update(s.F.doc(s.db, 'authorClaims', claim.id), { status: approve ? 'approved' : 'declined', decidedBy: u.uid, decidedAt: Date.now(), decisionNote: String(note).slice(0, 300) });
  await batch.commit();
}
export async function unlinkAuthor(slug) { const s = await load(); await s.F.deleteDoc(s.F.doc(s.db, 'authors', slug)); }

/* ---------- your data ---------- */
export async function exportData() {
  const u = current; if (!u) return null;
  return { account: { uid: u.uid, email: u.email }, profile: await getProfile(u.uid), progress: await loadProgress(), highlights: await loadHighlights() };
}
export async function deleteAccount() {
  const s = await load(); const u = current; if (!u) return;
  const snap = await s.F.getDocs(s.F.collection(s.db, 'users', u.uid, 'progress')), hls = await s.F.getDocs(hlCol(s, u.uid));
  const devs = await s.F.getDocs(s.F.query(s.F.collection(s.db, 'pushDevices'), s.F.where('uid', '==', u.uid))).catch(() => ({ forEach() {} }));
  const batch = s.F.writeBatch(s.db);
  snap.forEach((d) => batch.delete(d.ref)); hls.forEach((d) => batch.delete(d.ref)); devs.forEach((d) => batch.delete(d.ref));
  batch.delete(s.F.doc(s.db, 'users', u.uid));
  await batch.commit();
  try { await s.A.deleteUser(u); }
  catch (e) {
    if (e.code !== 'auth/requires-recent-login') throw e;
    await s.A.reauthenticateWithPopup(u, new s.A.GoogleAuthProvider()).catch(() => {}); await s.A.deleteUser(u);
  }
  ['jla:me', 'jla:progress', 'jla:weeks', 'jla:push'].forEach((k) => { try { localStorage.removeItem(k); } catch (e) {} });
}
