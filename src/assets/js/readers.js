/* Public reader profile (/readers/?u=<uid>): shown only if the reader made it public. */
import { loadIndex, badges, badgeHtml, esc } from './jla-core.js';

const box = document.getElementById('reader'), list = document.querySelector('[data-badges]');
const uid = new URLSearchParams(location.search).get('u');
const fail = (msg) => { box.querySelector('h1').textContent = msg; box.querySelector('.portrait').textContent = '·'; };

(async () => {
  const cloud = await import('./jla-cloud.js');
  if (!cloud.enabled || !uid) return fail('Profile not found');
  let p; try { p = await cloud.getProfile(uid); } catch (e) { p = null; }
  if (!p || !p.public) return fail('This profile is private');
  document.title = `${p.name} | ${document.title.split(' | ').pop()}`;
  const initials = String(p.name || '?').split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase();
  const st = p.stats || {};
  box.innerHTML = `<p class="crumb">Reader</p>
    ${p.photo ? `<img class="portrait" src="${esc(p.photo)}" alt="" width="132" height="132">` : `<div class="portrait monogram" aria-hidden="true">${esc(initials)}</div>`}
    <h1>${esc(p.name)}</h1>
    ${p.school ? `<p class="aff">${esc(p.school)}</p>` : ''}
    <div class="stats"><div><b>${st.finished || 0}</b><span>articles read</span></div><div><b>${st.streak || 0}</b><span>week streak</span></div><div><b>${(p.badges || []).length}</b><span>badges</span></div></div>
    ${p.bio ? `<p class="bio">${esc(p.bio)}</p>` : ''}`;
  // badge names and glyphs come from the shared definitions; the profile stores only the ids earned
  const index = await loadIndex();
  const defs = Object.fromEntries(badges(index, {}, {}).map((b) => [b.id, b]));
  list.innerHTML = (p.badges || []).filter((id) => defs[id]).map((id) => badgeHtml({ ...defs[id], earned: true })).join('') || '<li class="sub">No badges yet.</li>';
})();
