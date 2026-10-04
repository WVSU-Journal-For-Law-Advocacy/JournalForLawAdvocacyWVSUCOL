// Shared helpers for the notification functions (Firebase Admin SDK).
// The service-account key lives only in Netlify's environment (FIREBASE_SERVICE_ACCOUNT), never in the code.
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

function app() {
  if (getApps().length) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set in Netlify');
  return initializeApp({ credential: cert(JSON.parse(raw)) });
}
export const db = () => getFirestore(app());
export const auth = () => getAuth(app());
export const messaging = () => getMessaging(app());

export const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// the signed-in reader making the request (Firebase ID token in "Authorization: Bearer …")
export async function caller(req) {
  const m = (req.headers.get('authorization') || '').match(/^Bearer (.+)$/);
  if (!m) return null;
  try { return await auth().verifyIdToken(m[1]); } catch (e) { return null; }
}
export async function isEditor(uid) {
  return (await db().doc(`editors/${uid}`).get()).exists;
}

// devices that opted in to a kind of notification (optionally only some readers)
export async function devicesFor(topic, uids) {
  let q = db().collection('pushDevices').where('topics', 'array-contains', topic);
  const snap = await q.get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((d) => !uids || uids.includes(d.uid));
}

// send a notification to many devices; tokens that no longer work are removed
export async function send(devices, { title, body, url, tag }) {
  const tokens = [...new Set(devices.map((d) => d.token).filter(Boolean))];
  let sent = 0;
  for (let i = 0; i < tokens.length; i += 500) {
    const batch = tokens.slice(i, i + 500);
    const res = await messaging().sendEachForMulticast({
      tokens: batch,
      data: { title: String(title).slice(0, 120), body: String(body || '').slice(0, 300), url: String(url || '/'), tag: String(tag || 'jla') },
      webpush: { headers: { TTL: '86400', Urgency: 'normal' } },
    });
    sent += res.successCount;
    const dead = [];
    res.responses.forEach((r, k) => {
      if (!r.success && /registration-token-not-registered|invalid-registration-token|invalid-argument/.test((r.error && r.error.code) || '')) dead.push(batch[k]);
    });
    await Promise.all(devices.filter((d) => dead.includes(d.token)).map((d) => db().doc(`pushDevices/${d.id}`).delete().catch(() => {})));
  }
  return sent;
}

// ISO week like 2026-W40 (same as the site's reading streaks)
export function isoWeek(d = new Date()) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear(), w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7);
  return `${y}-W${String(w).padStart(2, '0')}`;
}
