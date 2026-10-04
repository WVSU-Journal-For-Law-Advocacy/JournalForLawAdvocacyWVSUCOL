// Article metrics: adds one view, full read, or PDF download to stats/{slug} (public to read, written only here).
// Called by the site with navigator.sendBeacon; no account needed and nothing about the reader is stored.
// The browser already counts each article once (once a day for views); this also checks the article exists
// and limits how fast any one address can count, so the figures stay honest.
import { FieldValue } from 'firebase-admin/firestore';
import { db, json } from '../lib/push.mjs';

const EVENTS = { view: 'views', read: 'reads', pdf: 'downloads' };
let known = null, knownAt = 0;           // the article list, cached for an hour
const recent = new Map();                // address -> [timestamps] (per running instance)

async function articles(origin) {
  if (known && Date.now() - knownAt < 36e5) return known;
  const r = await fetch(`${origin}/api/articles.json`);
  const j = await r.json();
  known = new Set(j.articles.map((a) => a.slug)); knownAt = Date.now();
  return known;
}

export default async (req, context) => {
  if (req.method !== 'POST') return json(405, { error: 'POST only' });
  let body; try { body = JSON.parse(await req.text()); } catch (e) { return json(400, { error: 'Bad request' }); }
  const field = EVENTS[body.ev], slug = String(body.slug || '');
  if (!field || !/^[a-z0-9-]{3,120}$/.test(slug)) return json(400, { error: 'Bad request' });

  // at most 60 counts a minute from one address
  const ip = (context && context.ip) || req.headers.get('x-nf-client-connection-ip') || 'unknown';
  const now = Date.now(), list = (recent.get(ip) || []).filter((t) => now - t < 60e3);
  if (list.length >= 60) return json(429, { error: 'Slow down' });
  list.push(now); recent.set(ip, list);

  try { if (!(await articles(new URL(req.url).origin)).has(slug)) return json(404, { error: 'Unknown article' }); }
  catch (e) { /* the list couldn't be read: count anyway rather than lose it */ }

  const ref = db().doc(`stats/${slug}`);
  await ref.set({ [field]: FieldValue.increment(1), updated: FieldValue.serverTimestamp() }, { merge: true });
  return json(200, { ok: true });
};
