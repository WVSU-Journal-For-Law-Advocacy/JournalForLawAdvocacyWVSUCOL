// Board members manage the editor list from the site (/editor/editors/).
// Only current editors may list, add, or remove; editors are added by the email they signed in with.
import { db, auth, caller, isEditor, json } from '../lib/push.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'POST only' });
  const me = await caller(req); if (!me) return json(401, { error: 'Sign in first' });
  if (!(await isEditor(me.uid))) return json(403, { error: 'Board members only' });
  let b; try { b = await req.json(); } catch (e) { return json(400, { error: 'Bad request' }); }
  const col = db().collection('editors');

  if (b.action === 'list') {
    const snap = await col.get();
    const list = await Promise.all(snap.docs.map(async (d) => {
      const x = d.data(); let email = x.email || '', name = x.name || '';
      if (!email || !name) { try { const u = await auth().getUser(d.id); email = email || u.email || ''; name = name || u.displayName || ''; } catch (e) {} }
      return { uid: d.id, name, email, role: x.role || '', added: x.added && x.added.toDate ? x.added.toDate().toISOString() : null, me: d.id === me.uid };
    }));
    return json(200, { editors: list.sort((a, c) => (a.name || a.email).localeCompare(c.name || c.email)) });
  }

  if (b.action === 'add') {
    const email = String(b.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(400, { error: 'Enter an email address' });
    let u; try { u = await auth().getUserByEmail(email); }
    catch (e) { return json(404, { error: 'No reader account uses that email yet. Ask them to sign in on the site once (My library), then add them.' }); }
    await col.doc(u.uid).set({ name: String(b.name || u.displayName || email).slice(0, 80), email, role: String(b.role || '').slice(0, 80), addedBy: me.uid, added: new Date() }, { merge: true });
    return json(200, { ok: true, uid: u.uid });
  }

  if (b.action === 'remove') {
    const uid = String(b.uid || '');
    if (!uid) return json(400, { error: 'Missing editor' });
    const count = (await col.get()).size;
    if (count <= 1) return json(400, { error: 'You are the only editor. Add someone else before removing yourself.' });
    await col.doc(uid).delete();
    return json(200, { ok: true });
  }
  return json(400, { error: 'Unknown action' });
};
