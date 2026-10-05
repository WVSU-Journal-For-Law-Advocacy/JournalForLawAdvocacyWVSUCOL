/* Author pages: show the author's verified profile (photo, bio, affiliation, links) and let a reader
   claim the page. Claims are reviewed by the board; once approved the author edits it in My library. */
import { local, esc } from './jla-core.js';

const head = document.getElementById('author-head');
const J = () => window.JLA || { say() {}, Sheet: { open() {}, close() {} } };

if (head) (async () => {
  const slug = head.dataset.slug, name = head.dataset.name;
  const cloud = await import('./jla-cloud.js'); if (!cloud.enabled) return;

  /* ---------- the verified profile ---------- */
  const p = await cloud.authorDoc(slug).catch(() => null);
  if (p && p.uid) {
    head.querySelector('.verified').hidden = false;
    if (p.photo && /^data:image\/|^https:\/\//.test(p.photo)) {
      const old = head.querySelector('.portrait'), img = document.createElement('img');
      img.className = 'portrait'; img.src = p.photo; img.alt = `Portrait of ${name}`; img.width = img.height = 112; old.replaceWith(img);
    }
    if (p.affiliation) { const a = head.querySelector('[data-aff]'); a.textContent = p.affiliation; a.hidden = false; }
    if (p.bio) { const b = head.querySelector('.bio'); b.textContent = p.bio; b.hidden = false; }
    const links = head.querySelector('.links'), add = (href, label) => {
      if (!href || links.querySelector(`a[href="${CSS.escape(href)}"]`)) return;
      const a = document.createElement('a'); a.href = href; a.rel = 'noopener'; a.textContent = label; links.append(a);
    };
    const url = (v) => (/^https?:\/\//.test(v) ? v : v ? `https://${v}` : '');
    add(url(p.linkedin), 'LinkedIn'); add(url(p.facebook), 'Facebook'); add(url(p.website), 'Website');
    if (p.orcid) add(`https://orcid.org/${p.orcid.replace(/^https?:\/\/orcid\.org\//, '')}`, 'ORCID');
  }

  /* ---------- "Is this you?" ---------- */
  const box = head.querySelector('[data-claim]');
  const me = local.me();
  if (p && p.uid) {
    if (me && me.uid === p.uid) { box.hidden = false; box.innerHTML = '<p>This is your author page. <a href="/account/#author">Edit it in My library →</a></p>'; }
    return;
  }
  box.hidden = false;
  box.innerHTML = '<p>Are you the author? <button type="button" class="linkish" data-claim-open>Claim this page</button> to add your photo, bio and links.</p>';
  box.addEventListener('click', async (e) => {
    if (!e.target.closest('[data-claim-open]')) return;
    if (!local.me()) return J().Sheet.open({ title: 'Claim this page', html: '<p>Sign in first, with the email you can be reached at, then come back to this page.</p><p class="acts" style="justify-content:center"><a class="btn" href="/account/">Sign in</a></p>' });
    await new Promise((ok) => cloud.onUser(() => ok()));
    const mine = (await cloud.myClaims().catch(() => [])).find((c) => c.slug === slug && c.status === 'pending');
    if (mine) return J().Sheet.open({ title: 'Claim this page', html: '<p>Your claim is waiting for the board to review it. You\'ll see the result in My library.</p>' });
    const node = document.createElement('form'); node.className = 'claim-form';
    node.innerHTML = `<p>You're asking to manage the author page of <b>${esc(name)}</b>. A board editor will check your claim before it goes live.</p>
      <label for="cl-note">How can the board confirm it's you?</label>
      <textarea id="cl-note" maxlength="600" rows="4" required placeholder="e.g. I wrote this piece as a JD-3 student; my WVSU email is …; my class adviser was …"></textarea>
      <p class="off">The board will also see the email you signed in with.</p>
      <p class="acts"><button class="btn" type="submit">Send claim</button></p>`;
    node.addEventListener('submit', async (ev) => {
      ev.preventDefault(); const btn = node.querySelector('button'); btn.disabled = true;
      try { await cloud.submitClaim(slug, name, node.querySelector('textarea').value); J().Sheet.close(); J().say('Claim sent. The board will review it'); box.innerHTML = '<p>Your claim is waiting for review.</p>'; }
      catch (err) { btn.disabled = false; J().say('Could not send the claim. Please try again'); }
    });
    J().Sheet.open({ title: 'Claim this page', node });
  });
})();
