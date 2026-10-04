// "A reader reported a comment": called by the site right after a report is filed.
// On the first report it alerts the editors' devices; once three different readers have reported
// the same comment, it hides it until an editor looks (Board → Moderation → Restore or Delete).
import { FieldValue } from 'firebase-admin/firestore';
import { db, caller, send, json } from '../lib/push.mjs';

const HIDE_AT = 3;

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'POST only' });
  const me = await caller(req); if (!me) return json(401, { error: 'Sign in first' });
  let body; try { body = await req.json(); } catch (e) { return json(400, { error: 'Bad request' }); }
  const id = String(body.commentId || ''); if (!/^[\w-]{10,40}$/.test(id)) return json(400, { error: 'Bad comment id' });

  // only the reader who filed the report can trigger this, and only once for it
  const repRef = db().doc(`reports/${id}_${me.uid}`), rep = (await repRef.get()).data();
  if (!rep || rep.uid !== me.uid || rep.handled) return json(200, { ok: true });
  await repRef.update({ handled: true });

  const cRef = db().doc(`comments/${id}`), c = (await cRef.get()).data();
  if (!c) return json(200, { ok: true });
  const n = (await db().collection('reports').where('commentId', '==', id).count().get()).data().count;

  let hidden = false;
  if (n >= HIDE_AT && !c.hidden) {
    await cRef.update({ hidden: true });
    await db().doc(`threads/${c.slug}`).set({ counts: { [c.pid]: FieldValue.increment(-1) } }, { merge: true }).catch(() => {});
    await db().collection('modlog').add({
      action: 'auto-hide', by: 'system', byName: 'Automatic', at: FieldValue.serverTimestamp(), note: `${n} readers reported it`,
      commentId: id, slug: c.slug, pid: c.pid, target: c.uid, targetName: c.name || '', text: String(c.text || '').slice(0, 300),
    });
    hidden = true;
  }

  // tell the editors on the first report, and again when it was hidden automatically
  if (n === 1 || hidden) {
    const eds = (await db().collection('editors').get()).docs.map((d) => d.id);
    const devices = [];
    for (let i = 0; i < eds.length; i += 30) {
      const snap = await db().collection('pushDevices').where('uid', 'in', eds.slice(i, i + 30)).get();
      snap.forEach((d) => devices.push({ id: d.id, ...d.data() }));
    }
    if (devices.length) await send(devices, {
      title: hidden ? 'A comment was hidden after reports' : 'A comment was reported',
      body: `${c.name}: ${c.text.length > 120 ? c.text.slice(0, 120) + '…' : c.text}`,
      url: '/editor/moderation/', tag: `report-${id}`,
    }).catch(() => {});
  }
  return json(200, { ok: true, hidden });
};
