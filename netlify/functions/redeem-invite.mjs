// "Claim your author page": redeems a board member's personal invitation link (/claim/?t=…).
// The link itself is the proof, so the account that opens it, signed in with any email, becomes the
// verified owner of that author page at once. Each link works once, expires after 90 days, and can be
// revoked by the board. Readers can't read invitations; only this function (with the admin key) can.
import { FieldValue } from 'firebase-admin/firestore';
import { db, caller, json } from '../lib/push.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'POST only' });
  const me = await caller(req); if (!me) return json(401, { error: 'Sign in first' });
  let body; try { body = await req.json(); } catch (e) { return json(400, { error: 'Bad request' }); }
  const token = String(body.token || ''); if (!/^[a-z0-9]{12,40}$/.test(token)) return json(400, { error: 'This link is not valid.' });

  const invRef = db().doc(`invites/${token}`);
  try {
    const result = await db().runTransaction(async (tx) => {
      const inv = (await tx.get(invRef)).data();
      if (!inv) return { status: 404, error: 'This link is not valid.' };
      if (inv.status === 'used') return inv.usedBy === me.uid ? { ok: true, slug: inv.slug, already: true } : { status: 409, error: 'This link has already been used. Ask the board for a new one.' };
      if (inv.status !== 'open') return { status: 410, error: 'This link has been withdrawn. Ask the board for a new one.' };
      if (inv.expires && inv.expires < Date.now()) return { status: 410, error: 'This link has expired. Ask the board for a new one.' };

      const authRef = db().doc(`authors/${inv.slug}`), page = (await tx.get(authRef)).data();
      if (page && page.uid && page.uid !== me.uid) return { status: 409, error: 'This author page is already verified to another account. Write to the board if this is a mistake.' };

      tx.set(authRef, { uid: me.uid, name: inv.authorName, approvedBy: inv.createdBy, approvedAt: Date.now(), via: 'invite' }, { merge: true });
      tx.update(invRef, { status: 'used', usedBy: me.uid, usedEmail: me.email || '', usedAt: FieldValue.serverTimestamp() });
      tx.set(db().doc(`outreach/${inv.slug}`), { status: 'claimed', claimedAt: FieldValue.serverTimestamp(), claimedEmail: me.email || '' }, { merge: true });
      return { ok: true, slug: inv.slug, name: inv.authorName };
    });
    return result.ok ? json(200, result) : json(result.status, { error: result.error });
  } catch (e) { return json(500, { error: 'Something went wrong. Please try again.' }); }
};
