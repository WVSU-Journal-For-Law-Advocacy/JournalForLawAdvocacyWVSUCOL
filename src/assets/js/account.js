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
  $('[data-s="badges"]').textContent = earned.length;
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
  const box = $('[data-block="highlights"]'); box.hidden = !hs.length; $('[data-hl-empty]').hidden = !!hs.length; if (!hs.length) return;
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
    try { await cloud.saveProfile(data); profile = { ...profile, ...data }; paintProfile(u); say('Profile saved'); }
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
// what went wrong, in plain words (Firebase error codes)
const SIGNIN_ERRORS = {
  'auth/network-request-failed': "You seem to be offline. Check your connection and try again.",
  'auth/too-many-requests': 'Too many attempts. Please wait a minute, then try again.',
  'auth/invalid-email': "That email address doesn't look right.",
  'auth/missing-email': 'Type your email address first.',
  'auth/user-disabled': 'This account has been switched off. Write to col_journal@wvsu.edu.ph.',
  'auth/unauthorized-domain': "Sign-in isn't set up for this address yet. Please tell the editors.",
  'auth/unauthorized-continue-uri': "Sign-in isn't set up for this address yet. Please tell the editors.",
  'auth/quota-exceeded': "The Journal has sent all the sign-in emails it can today. Use Google, or try again tomorrow.",
  'auth/invalid-action-code': 'That sign-in link was already used or has expired. Send yourself a new one.',
  'auth/expired-action-code': 'That sign-in link has expired. Send yourself a new one.',
  'auth/account-exists-with-different-credential': 'This email already signs in another way. Try the other option.',
  'auth/web-storage-unsupported': 'This browser is blocking sign-in (private mode or cookies off). Try your normal browser.',
  'auth/operation-not-allowed': "This way of signing in isn't switched on. Please tell the editors.",
};
const QUIET = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled'];
const SENT = 'jla:email-sent';
const TYPOS = { 'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gamil.com': 'gmail.com', 'gnail.com': 'gmail.com', 'gmail.co': 'gmail.com', 'gmail.con': 'gmail.com', 'gmaill.com': 'gmail.com',
  'yaho.com': 'yahoo.com', 'yahoo.co': 'yahoo.com', 'hotmial.com': 'hotmail.com', 'hotmail.co': 'hotmail.com', 'outlok.com': 'outlook.com', 'wvsu.edu': 'wvsu.edu.ph' };
const INBOX = [[/@(gmail|googlemail)\.com$/i, 'Open Gmail', 'https://mail.google.com/mail/u/0/#search/in%3Aanywhere+sign+in'], [/@(outlook|hotmail|live|msn)\./i, 'Open Outlook', 'https://outlook.live.com/mail/'],
  [/@(yahoo|ymail)\./i, 'Open Yahoo Mail', 'https://mail.yahoo.com/'], [/@(icloud|me|mac)\.com$/i, 'Open iCloud Mail', 'https://www.icloud.com/mail']];

function wireSignIn() {
  const card = $('.si-card'), msg = $('.si-msg'), g = $('[data-google]'), form = $('[data-email]'), typo = $('[data-typo]');
  const step = (name, busyText) => {
    $$('[data-si]').forEach((el) => { el.hidden = el.dataset.si !== name; });
    if (busyText) $('[data-busy-text]').textContent = busyText;
    card.setAttribute('aria-busy', String(name === 'busy'));
  };
  const fail = (e, fallback) => {
    if (e && QUIET.includes(e.code)) { msg.textContent = ''; return; }
    msg.textContent = (e && SIGNIN_ERRORS[e.code]) || fallback || `Sign-in didn't finish${e && e.code ? ` (${e.code.replace('auth/', '')})` : ''}. Please try again.`;
  };
  const clean = (v) => String(v || '').trim().toLowerCase();
  const valid = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

  // inside Messenger / Facebook / Instagram: Google blocks sign-in, so offer the real browser and the email link
  const app = cloud.inAppBrowser();
  if (app) {
    const box = $('.si-inapp'); box.hidden = false; box.querySelector('[data-app]').textContent = app;
    $('[data-google-wrap]').hidden = true;
    if (/Android/i.test(navigator.userAgent)) {
      const o = box.querySelector('[data-open-browser]'); o.hidden = false;
      o.href = `intent://${location.host}${location.pathname}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(location.href)};end`;
    }
  }

  g.addEventListener('click', async () => {
    msg.textContent = ''; g.disabled = true; g.classList.add('is-busy');
    try { await cloud.signInGoogle(); } // success: onUser() takes over
    catch (e) { fail(e); }
    finally { g.disabled = false; g.classList.remove('is-busy'); }
  });

  // "gmial.com" → did you mean gmail.com?
  form.email.addEventListener('input', () => {
    const v = clean(form.email.value), dom = v.split('@')[1], fix = dom && TYPOS[dom];
    typo.hidden = !fix;
    if (fix) typo.innerHTML = `Did you mean <button type="button" class="si-link" data-fix="${esc(v.split('@')[0])}@${fix}">${esc(v.split('@')[0])}@${fix}</button>?`;
  });
  typo.addEventListener('click', (e) => { const b = e.target.closest('[data-fix]'); if (b) { form.email.value = b.dataset.fix; typo.hidden = true; form.email.focus(); } });

  let cooldown = 0, timer;
  const resendBtn = $('[data-resend]');
  const tick = () => { resendBtn.disabled = cooldown > 0; resendBtn.textContent = cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend'; if (cooldown-- > 0) timer = setTimeout(tick, 1000); };
  const showSent = (email) => {
    $('[data-sent-to]').textContent = email;
    const box = INBOX.find(([re]) => re.test(email)), open = $('[data-open-mail]');
    open.hidden = !box; if (box) { open.textContent = box[1]; open.href = box[2]; }
    step('sent'); clearTimeout(timer); cooldown = 30; tick();
  };
  async function send(email) {
    msg.textContent = '';
    if (!valid(email)) { step('start'); form.email.focus(); return fail({ code: 'auth/invalid-email' }); }
    step('busy', 'Sending your link…');
    try {
      await cloud.sendEmailLink(email, location.origin + '/account/');
      try { localStorage.setItem(SENT, JSON.stringify({ email, at: Date.now() })); } catch (e) {}
      showSent(email);
    } catch (e) { step('start'); fail(e, "Couldn't send the link. Check the address and try again."); }
  }
  form.addEventListener('submit', (e) => { e.preventDefault(); send(clean(form.email.value)); });
  resendBtn.addEventListener('click', () => send($('[data-sent-to]').textContent));
  $('[data-change-email]').addEventListener('click', () => {
    try { localStorage.removeItem(SENT); } catch (e) {}
    clearTimeout(timer); msg.textContent = ''; step('start'); form.email.select();
  });

  // came back to this page before opening the email: keep showing "Check your inbox" for an hour
  try { const s = JSON.parse(localStorage.getItem(SENT) || 'null'); if (s && Date.now() - s.at < 36e5) { form.email.value = s.email; showSent(s.email); cooldown = 0; tick(); } } catch (e) {}

  return { step, fail, confirmEmail: () => new Promise((resolve) => {
    step('confirm'); const f = $('[data-confirm]'); f.email.focus();
    f.addEventListener('submit', (e) => {
      e.preventDefault(); const v = clean(f.email.value);
      if (!valid(v)) return fail({ code: 'auth/invalid-email' });
      msg.textContent = ''; step('busy', 'Signing you in…'); resolve(v);
    });
  }) };
}

/* ---------- start ---------- */
/* ---------- your author page(s): claim status, and editing a verified page ---------- */
async function paintAuthor() {
  let pages = [], claims = [], index = null;
  try { [pages, claims, index] = await Promise.all([cloud.myAuthorPages(), cloud.myClaims(), loadIndex()]); } catch (e) { return; }
  const box = $('[data-author-box]');
  const open = claims.filter((c) => c.status !== 'approved' || !pages.some((p) => p.slug === c.slug));
  box.hidden = !pages.length && !open.length; if (box.hidden) return;
  const STATUS = { pending: 'Waiting for the board to review', declined: 'Not approved', approved: 'Approved' };
  $('[data-claims]').innerHTML = open.map((c) => `<li><a href="/authors/${esc(c.slug)}/">${esc(c.authorName)}</a><span class="cl-st cl-${esc(c.status)}">${STATUS[c.status] || esc(c.status)}</span>${c.decisionNote ? `<small>${esc(c.decisionNote)}</small>` : ''}</li>`).join('');
  if (pages.length) { try { const fl = JSON.parse(localStorage.getItem('jla:flags') || '{}'); if (!fl.author) { fl.author = Date.now(); localStorage.setItem('jla:flags', JSON.stringify(fl)); paint(); } } catch (e) {} }
  $('[data-author-pages]').innerHTML = pages.map((p) => `
    <form class="author-form" data-slug="${esc(p.slug)}">
      <p class="af-head"><a href="/authors/${esc(p.slug)}/">${esc(p.name || p.slug)}</a> <span class="cl-st cl-approved">Verified</span></p>
      <label class="ap-photo af-photo" title="Change photo"><img alt="" width="96" height="96"${p.photo ? ` src="${esc(p.photo)}"` : ' hidden'}><span class="monogram"${p.photo ? ' hidden' : ''}>${esc(initials(p.name))}</span><input type="file" accept="image/*" hidden><span class="ap-edit">Change</span></label>
      <div class="field"><label>Affiliation</label><input name="affiliation" maxlength="120" value="${esc(p.affiliation)}" placeholder="e.g. Associate, Law Firm · WVSU College of Law, JD 2024"></div>
      <div class="field"><label>Bio</label><textarea name="bio" maxlength="800" rows="4" placeholder="A few lines about you and your work">${esc(p.bio)}</textarea></div>
      <div class="field"><label>LinkedIn</label><input name="linkedin" maxlength="200" value="${esc(p.linkedin)}" placeholder="linkedin.com/in/…"></div>
      <div class="field"><label>ORCID</label><input name="orcid" maxlength="40" value="${esc(p.orcid)}" placeholder="0000-0000-0000-0000"></div>
      <div class="field"><label>Facebook</label><input name="facebook" maxlength="200" value="${esc(p.facebook)}" placeholder="facebook.com/…"></div>
      <div class="field"><label>Website</label><input name="website" maxlength="200" value="${esc(p.website)}" placeholder="https://…"></div>
      <p class="acts"><button class="btn sm" type="submit">Save author page</button></p>
    </form>`).join('');
  $$('.author-form').forEach((f) => {
    let photo = null;
    f.querySelector('input[type=file]').addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0]; if (!file) return;
      try { photo = await shrink(file); const img = f.querySelector('.af-photo img'); img.src = photo; img.hidden = false; f.querySelector('.af-photo .monogram').hidden = true; }
      catch (err) { say('That photo could not be used'); }
    });
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(['affiliation', 'bio', 'linkedin', 'orcid', 'facebook', 'website'].map((k) => [k, f.elements[k].value]));
      if (photo) data.photo = photo;
      try { await cloud.saveAuthorProfile(f.dataset.slug, data); say('Author page saved'); } catch (err) { say('Could not save. Please try again'); }
    });
  });
}

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

/* ---------- tabs: Reading · Highlights · Badges · Author · Board · Settings (remembered in the address, e.g. #badges) ---------- */
const TABS = ['reading', 'highlights', 'badges', 'author', 'board', 'settings'];
function goTab(name, focus) {
  const btn = $(`[data-tab-btn="${name}"]`); if (!btn || btn.hidden) name = 'reading';
  $$('[data-tab-btn]').forEach((b) => { const on = b.dataset.tabBtn === name; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); });
  $$('[data-tab]').forEach((p) => { p.hidden = p.dataset.tab !== name; });
  if (location.hash.slice(1) !== name) history.replaceState(null, '', name === 'reading' ? location.pathname : '#' + name);
}
root.addEventListener('click', (e) => {
  const b = e.target.closest('[data-tab-btn]'); if (b) return goTab(b.dataset.tabBtn);
  const g = e.target.closest('[data-goto]'); if (g) { e.preventDefault(); goTab(g.dataset.goto); $('.lib-tabs').scrollIntoView({ block: 'start', behavior: 'smooth' }); }
});
$('.lib-tabs').addEventListener('keydown', (e) => {
  if (!['ArrowRight', 'ArrowLeft'].includes(e.key)) return;
  const vis = $$('[data-tab-btn]').filter((b) => !b.hidden), i = vis.findIndex((b) => b.getAttribute('aria-selected') === 'true');
  goTab(vis[(i + (e.key === 'ArrowRight' ? 1 : vis.length - 1)) % vis.length].dataset.tabBtn, true);
});
// the Author and Board tabs appear only for authors with a claim or page, and for editors
const gate = (sel, tab) => { const el = $(sel), b = $(`[data-tab-btn="${tab}"]`); const sync = () => { b.hidden = el.hidden; if (el.hidden && b.getAttribute('aria-selected') === 'true') goTab('reading'); else if (!el.hidden && location.hash === '#' + tab) goTab(tab); }; new MutationObserver(sync).observe(el, { attributes: true, attributeFilter: ['hidden'] }); sync(); };
gate('[data-author-box]', 'author'); gate('[data-board]', 'board');
// a soft fade at the edge when the tabs don't all fit (phones with Author and Board tabs)
const tabBar = $('.lib-tabs');
const fade = () => { tabBar.classList.toggle('is-scroll', tabBar.scrollWidth > tabBar.clientWidth + 2); tabBar.classList.toggle('at-end', tabBar.scrollLeft + tabBar.clientWidth >= tabBar.scrollWidth - 4); };
tabBar.addEventListener('scroll', fade, { passive: true }); addEventListener('resize', fade);
new MutationObserver(fade).observe(tabBar, { attributes: true, subtree: true, attributeFilter: ['hidden'] }); fade();
goTab(TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'reading');
addEventListener('hashchange', () => { const h = location.hash.slice(1); if (TABS.includes(h)) goTab(h); });

/* ---------- app & offline: install button and the articles saved on this device ---------- */
function paintApp() {
  const A = window.JLA_APP; if (!A) return;
  const box = $('[data-app-box]'), btn = $('[data-install-btn]'), saved = Object.entries(A.savedList());
  btn.hidden = A.standalone || !A.installable();
  $('[data-install-how]').hidden = A.standalone || !btn.hidden;
  if (A.standalone) $('[data-app-line]').textContent = "You're using the app. Articles you save stay readable without a connection.";
  $('[data-saved-wrap]').hidden = !saved.length;
  $('[data-saved]').innerHTML = saved.sort((a, b) => b[1].saved - a[1].saved).map(([url, s]) =>
    `<li><a href="${esc(url)}">${esc(s.title)}</a><button type="button" data-unsave="${esc(url)}" aria-label="Remove from offline">Remove</button></li>`).join('');
  box.hidden = false;
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
  cloud = mod; show('out'); const si = wireSignIn();
  // finishing an email link (asks for the address only if it was opened on another device)
  if (await mod.isEmailLink().catch(() => false)) {
    si.step('busy', 'Signing you in…');
    try { if (await mod.finishEmailLink(si.confirmEmail)) { try { localStorage.removeItem('jla:email-sent'); } catch (e) {} } }
    catch (e) { si.step('start'); si.fail(e, 'That sign-in link was already used or has expired. Send yourself a new one.'); history.replaceState(null, '', location.pathname); }
  }
  // back from Google's sign-in page (when the pop-up was blocked)
  mod.redirectResult().catch((e) => si.fail(e));
  let wired = false;
  mod.onUser(async (u) => {
    if (!u) { profile = null; show('out'); $('[data-push-box]').hidden = true; $('[data-board]').hidden = true; $('[data-author-box]').hidden = true; paint(); return; }
    try { localStorage.removeItem('jla:email-sent'); } catch (e) {}
    const synced = await mod.sync().catch(() => null);
    profile = (synced && synced.profile) || null;
    if (!profile) { // first sign-in: create the profile
      profile = { name: u.displayName || (u.email || 'Reader').split('@')[0], joined: Date.now(), public: false, consent: Date.now() };
      await mod.saveProfile(profile).catch(() => {});
    }
    show('in'); paintProfile(u); if (!wired) { wireProfile(u); wirePush(); wired = true; } paint(); paintHighlights();
    mod.isEditor().then(async (ed) => {
      $('[data-board]').hidden = !ed;
      if (ed) { const n = (await mod.pendingClaims().catch(() => [])).length; const c = $('[data-claim-count]'); c.hidden = !n; c.textContent = n; }
    });
    paintAuthor();
  });
})();
