/* "My library" (/account/): sign-in, profile, stats, streak, badges, continue reading, read next. */
import { local, loadIndex, stats, badges, suggest, badgeHtml, cardHtml, esc } from './jla-core.js';

const root = document.getElementById('acct');
const $ = (s) => root.querySelector(s), $$ = (s) => [...root.querySelectorAll(s)];
const say = (m) => { const t = document.getElementById('toast'); if (!t) return; t.textContent = m; t.classList.add('on'); clearTimeout(say.t); say.t = setTimeout(() => t.classList.remove('on'), 2600); };
const show = (state) => $$('[data-when]').forEach((el) => { el.hidden = el.dataset.when !== state; });
const fmt = (n) => n >= 10000 ? `${Math.round(n / 1000)}k` : n.toLocaleString('en-PH');
const initials = (n) => String(n || '?').split(/\s+/).filter((w) => /^[A-Z]/i.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

let cloud = null, profile = null;

/* ---------- the dashboard (works signed in or out) ---------- */
async function paint() {
  let index; try { index = await loadIndex(); } catch (e) { return; }
  const all = local.all(), weeks = local.weeks(), st = stats(index, all, weeks);
  $('[data-s="finished"]').textContent = st.finished;
  $('[data-s="inProgress"]').textContent = st.inProgress;
  $('[data-s="unread"]').textContent = st.unread;
  $('[data-s="streak"]').textContent = st.streak.current;
  $('[data-s="words"]').textContent = fmt(st.words);
  const pct = Math.round((100 * st.finished) / st.total);
  $('[data-overall]').style.width = pct + '%';
  $('[data-overall-text]').textContent = `${st.finished} of ${st.total} pieces in the journal read (${pct}%)${st.streak.thisWeek ? ' · this week counted ✓' : ' · read 10 minutes this week to keep your streak'}`;

  const bySlug = Object.fromEntries(index.articles.map((a) => [a.slug, a]));
  const going = Object.entries(all).filter(([s, p]) => bySlug[s] && !p.done && p.pct > 0).sort((a, b) => b[1].updated - a[1].updated).slice(0, 4);
  $('[data-block="continue"]').hidden = !going.length;
  $('[data-continue]').innerHTML = going.map(([s, p]) => cardHtml(bySlug[s], p)).join('');
  $('[data-next]').innerHTML = suggest(index, all, { exclude: going.map(([s]) => s) }).map((a) => cardHtml(a, all[a.slug])).join('');

  const bs = badges(index, all, weeks), earned = bs.filter((b) => b.earned);
  $('[data-badge-sum]').textContent = `${earned.length} of ${bs.length} earned`;
  $('[data-badges]').innerHTML = [...earned, ...bs.filter((b) => !b.earned).sort((a, b) => b.have / b.need - a.have / a.need)].map(badgeHtml).join('');

  if (st.finished >= 3) $('[data-write-line]').textContent = `You've read ${st.finished} pieces. You know what makes a good one: write the next.`;
  if (profile) {
    $('.ap-streak').textContent = st.streak.current ? `🔥 ${st.streak.current}-week reading streak` : 'Start a weekly reading streak';
    if (cloud) cloud.saveProfile({ weeks, stats: { finished: st.verified, words: st.words, streak: st.streak.current }, badges: earned.map((b) => b.id) }).catch(() => {});
  }
}

/* ---------- highlights & notes, grouped by article ---------- */
async function paintHighlights() {
  let hs = [], index;
  try { [hs, index] = await Promise.all([cloud.loadHighlights(), loadIndex()]); } catch (e) { return; }
  const box = $('[data-block="highlights"]'); box.hidden = !hs.length; if (!hs.length) return;
  const bySlug = Object.fromEntries(index.articles.map((a) => [a.slug, a])), groups = {};
  hs.sort((a, b) => (b.created || 0) - (a.created || 0)).forEach((h) => { (groups[h.slug] = groups[h.slug] || []).push(h); });
  $('[data-highlights]').innerHTML = Object.entries(groups).filter(([s]) => bySlug[s]).map(([s, list]) => `
    <article class="hl-group"><h3><a href="${bySlug[s].url}">${esc(bySlug[s].title)}</a></h3>
    ${list.map((h) => `<blockquote>${esc(h.text)}${h.note ? `<p class="hl-note">${esc(h.note)}</p>` : ''}</blockquote>`).join('')}</article>`).join('');
}

/* ---------- profile card ---------- */
function paintProfile(u) {
  const p = profile || {}, name = p.name || u.displayName || 'Reader';
  $('.ap-name').textContent = name;
  $('.ap-school').textContent = p.school || u.email || '';
  const img = $('.ap-photo img'), mono = $('.ap-photo .monogram');
  const photo = p.photo || u.photoURL || '';
  img.hidden = !photo; if (photo) img.src = photo; mono.hidden = !!photo; mono.textContent = initials(name);
  const f = $('[data-profile]');
  f.name.value = name; f.school.value = p.school || ''; f.bio.value = p.bio || ''; f.public.checked = !!p.public;
  const link = $('[data-public-link]'); link.hidden = !p.public; link.href = `/readers/?u=${encodeURIComponent(u.uid)}`;
}

// a square, small photo made in the browser (no file storage needed)
async function shrink(file, px = 256) {
  const bmp = await createImageBitmap(file);
  const s = Math.min(bmp.width, bmp.height), cv = document.createElement('canvas'); cv.width = cv.height = px;
  cv.getContext('2d').drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, px, px);
  for (const [type, q] of [['image/webp', 0.82], ['image/jpeg', 0.8], ['image/jpeg', 0.6]]) {
    const url = cv.toDataURL(type, q); if (url.startsWith(`data:${type}`) && url.length < 80000) return url;
  }
  throw new Error('too big');
}

function wireProfile(u) {
  $('[data-profile]').addEventListener('submit', async (e) => {
    e.preventDefault(); const f = e.target;
    const data = { name: f.name.value.trim().slice(0, 80), school: f.school.value.trim().slice(0, 80), bio: f.bio.value.trim().slice(0, 280), public: f.public.checked };
    try { await cloud.saveProfile(data); profile = { ...profile, ...data }; paintProfile(u); say('Profile saved'); $('.ap-editor').open = false; }
    catch (err) { say('Could not save. Please try again'); }
  });
  $('.ap-photo input').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0]; if (!file) return;
    try { const photo = await shrink(file), thumb = await shrink(file, 64); await cloud.saveProfile({ photo, thumb }); profile = { ...profile, photo, thumb }; paintProfile(u); say('Photo updated'); }
    catch (err) { say('That photo could not be used'); }
  });
  $('[data-signout]').addEventListener('click', async () => { await cloud.signOut(); location.reload(); });
  $('[data-export]').addEventListener('click', async () => {
    const data = await cloud.exportData();
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = 'my-jla-data.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  });
  $('[data-delete]').addEventListener('click', async () => {
    if (!confirm('Delete your account, profile and reading history for good? This cannot be undone.')) return;
    try { await cloud.deleteAccount(); say('Your account was deleted'); setTimeout(() => location.reload(), 1200); }
    catch (err) { say('Please sign out, sign in again, then delete'); }
  });
}

/* ---------- sign-in ---------- */
function wireSignIn() {
  const consent = $('#consent'), g = $('[data-google]'), form = $('[data-email]'), msg = $('.acct-signin .msg');
  const sync = () => { g.disabled = !consent.checked; form.querySelector('button').disabled = !consent.checked; };
  consent.addEventListener('change', sync); sync();
  // inside Messenger / Facebook / Instagram: Google sign-in is blocked, so offer the real browser and the email link
  const app = cloud.inAppBrowser();
  if (app) {
    const box = $('.inapp'); box.hidden = false; box.querySelector('[data-app]').textContent = app;
    g.closest('.acts').hidden = true;
    if (/Android/i.test(navigator.userAgent)) {
      const o = box.querySelector('[data-open-browser]'); o.hidden = false;
      o.href = `intent://${location.host}${location.pathname}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(location.href)};end`;
    }
  }
  g.addEventListener('click', async () => {
    try { await cloud.signInGoogle(); } catch (e) { if (e.code !== 'auth/popup-closed-by-user') msg.textContent = 'Google sign-in did not finish. Try again, or use the email link.'; }
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); const email = form.email.value.trim();
    try { await cloud.sendEmailLink(email, location.origin + '/account/'); msg.textContent = `Check ${email} for a sign-in link. Open it on this device.`; }
    catch (err) { msg.textContent = 'Could not send the link. Check the address and try again.'; }
  });
}

/* ---------- start ---------- */
/* ---------- notifications: opt in per kind, on this device ---------- */
function wirePush() {
  const box = $('[data-push-box]'); if (!cloud || !cloud.pushConfigured()) return;
  box.hidden = false;
  const msg = box.querySelector('.push-msg'), boxes = [...box.querySelectorAll('input[type=checkbox]')];
  const st = cloud.pushState(), blocker = cloud.pushBlocker();
  boxes.forEach((b) => { b.checked = !!(st && st.topics.includes(b.value) && Notification.permission === 'granted'); b.disabled = !!blocker; });
  if (blocker) { msg.textContent = blocker; return; }
  box.addEventListener('change', async () => {
    const topics = boxes.filter((b) => b.checked).map((b) => b.value);
    boxes.forEach((b) => { b.disabled = true; }); msg.textContent = topics.length ? 'Saving…' : '';
    try { await cloud.setPushTopics(topics); msg.textContent = topics.length ? 'Saved. Notifications will come to this device.' : 'Notifications are off on this device.'; }
    catch (e) {
      boxes.forEach((b) => { b.checked = false; });
      msg.textContent = e.message === 'permission' ? 'You chose not to allow notifications. You can allow them in your browser settings.' : 'Could not turn notifications on here. Try again, or try in Chrome.';
    }
    boxes.forEach((b) => { b.disabled = false; });
  });
}

/* ---------- app & offline: install button and the articles saved on this device ---------- */
function paintApp() {
  const A = window.JLA_APP; if (!A) return;
  const box = $('[data-app-box]'), btn = $('[data-install-btn]'), saved = Object.entries(A.savedList());
  btn.hidden = A.standalone || !A.canInstall();
  if (A.standalone) $('[data-app-line]').textContent = "You're using the app. Articles you save stay readable without a connection.";
  $('[data-saved-wrap]').hidden = !saved.length;
  $('[data-saved]').innerHTML = saved.sort((a, b) => b[1].saved - a[1].saved).map(([url, s]) =>
    `<li><a href="${esc(url)}">${esc(s.title)}</a><button type="button" data-unsave="${esc(url)}" aria-label="Remove from offline">Remove</button></li>`).join('');
  box.hidden = btn.hidden && !saved.length && !A.standalone;
}
root.addEventListener('click', (e) => {
  const u = e.target.closest('[data-unsave]'); if (!u) return;
  const url = u.dataset.unsave, list = window.JLA_APP.savedList(), item = list[url];
  delete list[url]; try { localStorage.setItem('jla:saved', JSON.stringify(list)); } catch (err) {}
  if (navigator.serviceWorker && navigator.serviceWorker.controller) navigator.serviceWorker.controller.postMessage({ type: 'unsave', urls: [url, ...(item && item.pdf ? [item.pdf] : [])] });
  paintApp();
});
document.addEventListener('jla:installable', paintApp);
if (window.JLA_APP) paintApp(); else document.addEventListener('jla:ready', paintApp);

paint();
(async () => {
  const mod = await import('./jla-cloud.js');
  if (!mod.enabled) { show('off'); return; }
  cloud = mod; show('out'); wireSignIn();
  try { await mod.finishEmailLink(async () => prompt('Confirm your email to finish signing in')); }
  catch (e) { $('.acct-signin .msg').textContent = 'That sign-in link has expired or was already used. Send a new one.'; }
  let wired = false;
  mod.onUser(async (u) => {
    if (!u) { profile = null; show('out'); $('[data-push-box]').hidden = true; $('[data-board]').hidden = true; paint(); return; }
    const synced = await mod.sync().catch(() => null);
    profile = (synced && synced.profile) || null;
    if (!profile) { // first sign-in: create the profile
      profile = { name: u.displayName || (u.email || 'Reader').split('@')[0], joined: Date.now(), public: false, consent: Date.now() };
      await mod.saveProfile(profile).catch(() => {});
    }
    show('in'); paintProfile(u); if (!wired) { wireProfile(u); wirePush(); wired = true; } paint(); paintHighlights();
    mod.isEditor().then((ed) => { $('[data-board]').hidden = !ed; });
  });
})();
