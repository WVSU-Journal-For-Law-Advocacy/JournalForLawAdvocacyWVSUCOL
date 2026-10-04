// "Someone replied to your comment": called by the site right after a reply is posted.
import { db, caller, devicesFor, send, json } from '../lib/push.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'POST only' });
  const me = await caller(req); if (!me) return json(401, { error: 'Sign in first' });
  let body; try { body = await req.json(); } catch (e) { return json(400, { error: 'Bad request' }); }
  const id = String(body.commentId || ''); if (!/^[\w-]{10,40}$/.test(id)) return json(400, { error: 'Bad comment id' });

  const reply = (await db().doc(`comments/${id}`).get()).data();
  if (!reply || reply.uid !== me.uid || !reply.parent) return json(200, { sent: 0 }); // only the person who replied can trigger it
  if (reply.notified) return json(200, { sent: 0 }); // one alert per reply, however often this is called
  await db().doc(`comments/${id}`).update({ notified: true });
  const parent = (await db().doc(`comments/${reply.parent}`).get()).data();
  if (!parent || parent.uid === me.uid) return json(200, { sent: 0 });

  const devices = await devicesFor('replies', [parent.uid]);
  const sent = await send(devices, {
    title: `${reply.name} replied to your comment`,
    body: reply.text.length > 140 ? reply.text.slice(0, 140) + '…' : reply.text,
    url: `/articles/${reply.slug}/?thread=${encodeURIComponent(reply.pid)}`,
    tag: `reply-${reply.parent}`,
  });
  return json(200, { sent });
};
