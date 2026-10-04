// Board announcements to readers who opted in: a new volume, or a call for papers.
// Only editors (Firestore editors/{uid}) can send.
import { db, caller, isEditor, devicesFor, send, json } from '../lib/push.mjs';

const TOPICS = { volumes: 'New volume published', cfp: 'Calls for papers' };

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'POST only' });
  const me = await caller(req); if (!me) return json(401, { error: 'Sign in first' });
  if (!(await isEditor(me.uid))) return json(403, { error: 'Board members only' });
  let b; try { b = await req.json(); } catch (e) { return json(400, { error: 'Bad request' }); }
  const topic = String(b.topic || ''), title = String(b.title || '').trim(), body = String(b.body || '').trim();
  let url = String(b.url || '/').trim();
  if (!TOPICS[topic]) return json(400, { error: 'Choose who to notify' });
  if (!title) return json(400, { error: 'Add a title' });
  if (!url.startsWith('/')) { try { url = new URL(url).pathname; } catch (e) { url = '/'; } } // keep links inside the Journal

  const devices = await devicesFor(topic);
  if (b.test) { // "send a test to me first"
    const mine = devices.filter((d) => d.uid === me.uid);
    return json(200, { sent: await send(mine, { title, body, url, tag: `test-${topic}` }), test: true, audience: devices.length });
  }
  const sent = await send(devices, { title, body, url, tag: topic });
  await db().collection('announcements').add({ topic, title, body, url, by: me.uid, sent, at: new Date() });
  return json(200, { sent, audience: devices.length });
};
