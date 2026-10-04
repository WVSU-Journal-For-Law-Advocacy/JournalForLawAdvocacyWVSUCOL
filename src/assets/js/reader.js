/* Verified reading on article pages.
   A paragraph counts as read only after it has been on screen long enough to read it
   (no faster than ~600 words a minute), with the tab visible, taking paragraphs top to bottom.
   % read = words in read paragraphs / all words. Finished = 90%+ read and the last paragraph reached.
   Works without an account (kept in this browser); synced to the account when signed in. */

import { local, loadIndex, badges, suggest, addSeconds, stats, cardHtml, badgeHtml } from './jla-core.js';

const text = document.getElementById('fulltext');
const dataEl = document.getElementById('share-data');
const slug = dataEl ? JSON.parse(dataEl.textContent).slug : null;
let cloud = null; // set when accounts are configured and the reader is signed in

/* ---------- accounts (only if configured; only loads Firebase if this browser has signed in before) ---------- */
async function connect(onReady) {
  const mod = await import('./jla-cloud.js');
  if (!mod.enabled || !local.me()) return;
  mod.onUser(async (u) => { if (!u) { cloud = null; return; } cloud = mod; await mod.sync().catch(() => {}); onReady && onReady(); });
}

/* ---------- PDF-only articles: self-reported ---------- */
const markBox = document.querySelector('[data-mark-read]');
if (markBox && slug) {
  const btn = markBox.querySelector('button'), note = markBox.querySelector('.mr-note');
  const show = () => { const p = local.get(slug); const done = p && p.done; btn.textContent = done ? 'Marked as read ✓' : 'Mark as read'; btn.setAttribute('aria-pressed', !!done); note.hidden = !done; };
  btn.addEventListener('click', async () => {
    const p = local.get(slug); const done = !(p && p.done);
    const rec = { read: [], pct: done ? 100 : 0, done, doneAt: done ? Date.now() : null, self: true, words: 0 };
    local.put(slug, rec); show(); if (cloud) cloud.saveProgress(slug, rec).catch(() => {});
  });
  show(); connect(show);
}

if (text && slug) {
  /* ---------- paragraphs, with ids that survive small edits elsewhere in the text ---------- */
  const hash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36).slice(0, 6); };
  const paras = [...text.querySelectorAll('p, li, blockquote, h2, h3')]
    .filter((el) => !(/^(LI|BLOCKQUOTE)$/.test(el.tagName) && el.querySelector('p, li, blockquote'))) // count the innermost blocks only
    .map((el) => {
      const c = el.cloneNode(true); c.querySelectorAll('sup, .footnote-ref').forEach((x) => x.remove());
      const t = c.textContent.replace(/\s+/g, ' ').trim(); const words = t ? t.split(' ').length : 0;
      return { el, t, words, heading: /^H[23]$/.test(el.tagName) };
    })
    .filter((p) => p.words > 0);
  const seen = new Set();
  paras.forEach((p) => { let id = hash(p.t.toLowerCase().slice(0, 200)); while (seen.has(id)) id += 'x'; seen.add(id); p.id = id; p.el.dataset.pid = id; });
  const totalWords = paras.reduce((n, p) => n + p.words, 0) || 1;
  const need = (p) => p.heading ? 0.4 : Math.min(20, Math.max(1.2, p.words / 10)); // seconds

  let rec = local.get(slug) || { read: [], pct: 0, done: false, words: totalWords };
  const read = new Set(rec.read || []);
  paras.forEach((p) => { if (read.has(p.id)) p.el.classList.add('is-read'); });

  /* ---------- the little "% read" pill ---------- */
  const pill = document.createElement('button');
  pill.type = 'button'; pill.className = 'read-pill'; pill.setAttribute('aria-live', 'polite');
  pill.innerHTML = '<span class="rp-ring"><svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15.5"/><circle class="rp-on" cx="18" cy="18" r="15.5"/></svg></span><span class="rp-txt"></span>';
  const tip = document.createElement('div'); tip.className = 'read-tip'; tip.hidden = true;
  tip.innerHTML = '<b>How reading is counted</b><p>A paragraph counts once it has been on your screen long enough to read it. Skimming or jumping to the end doesn\'t count. Finish 90% and reach the end to complete the article.</p><p class="rt-acc"></p>';
  document.body.append(pill, tip);
  pill.addEventListener('click', () => { tip.hidden = !tip.hidden; });
  document.addEventListener('click', (e) => { if (!tip.hidden && !e.target.closest('.read-tip, .read-pill')) tip.hidden = true; });
  const accLine = () => {
    const me = local.me();
    tip.querySelector('.rt-acc').innerHTML = me ? `Saved to your account. <a href="/account/">My library →</a>` : `Saved in this browser. <a href="/account/">Sign in</a> to keep it, earn badges, and see your stats.`;
  };
  accLine();

  const pctNow = () => Math.round(100 * paras.filter((p) => read.has(p.id)).reduce((n, p) => n + p.words, 0) / totalWords);
  const minsLeft = () => Math.max(0, Math.ceil(paras.filter((p) => !read.has(p.id)).reduce((n, p) => n + p.words, 0) / 230));
  const lastId = paras[paras.length - 1].id;
  function render() {
    const pct = rec.done ? 100 : pctNow();
    pill.querySelector('.rp-on').style.strokeDasharray = `${(pct / 100) * 97.4} 97.4`;
    pill.querySelector('.rp-txt').textContent = rec.done ? 'Read ✓' : pct ? `${pct}% · ${minsLeft()} min left` : `${minsLeft()} min read`;
    pill.classList.toggle('is-done', !!rec.done);
  }
  render();

  /* ---------- saving (browser at once; account at most every 20 s, and when leaving) ---------- */
  let dirty = false, lastPush = 0, pushT;
  const save = () => { rec = { ...rec, read: [...read], pct: rec.done ? 100 : pctNow(), words: totalWords }; local.put(slug, rec); dirty = true; schedule(); };
  const schedule = () => { if (!cloud || pushT) return; pushT = setTimeout(push, Math.max(0, 20000 - (Date.now() - lastPush))); };
  async function push() {
    pushT = null; if (!cloud || !dirty) return; dirty = false; lastPush = Date.now();
    try {
      await cloud.saveProgress(slug, local.get(slug));
      const index = await loadIndex(); const all = local.all(), weeks = local.weeks();
      const st = stats(index, all, weeks);
      await cloud.saveProfile({ weeks, stats: { finished: st.verified, words: st.words, streak: st.streak.current }, badges: badges(index, all, weeks).filter((b) => b.earned).map((b) => b.id) });
    } catch (e) { dirty = true; }
  }
  addEventListener('pagehide', () => { if (cloud && dirty) push(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && cloud && dirty) push(); });

  /* ---------- the reading clock ---------- */
  // on screen = at least 60% of the paragraph is visible, or it fills half the screen (long paragraphs)
  const onScreen = (el) => {
    const r = el.getBoundingClientRect(), shown = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0);
    return shown > 0 && (shown >= r.height * 0.6 || shown >= innerHeight * 0.5);
  };
  const dwell = new Map(); let secs = 0, lastTick = performance.now(), idle = 0;
  addEventListener('scroll', () => { idle = 0; }, { passive: true });
  ['pointerdown', 'keydown', 'touchstart'].forEach((ev) => addEventListener(ev, () => { idle = 0; }, { passive: true }));
  const step = (dt) => {
    if (document.visibilityState !== 'visible' || rec.done) return;
    idle += dt; if (idle > 120) return; // nobody has touched the page in two minutes
    // credit time to the first unread paragraph on screen: reading goes top to bottom
    const p = paras.find((x) => !read.has(x.id) && onScreen(x.el)); if (!p) return;
    const t = (dwell.get(p.id) || 0) + dt; dwell.set(p.id, t); secs += dt;
    if (secs >= 15) { addSeconds(Math.round(secs)); secs = 0; }
    if (t >= need(p)) {
      read.add(p.id); p.el.classList.add('is-read');
      const pct = pctNow();
      if (!rec.done && pct >= 90 && read.has(lastId)) { rec = { ...rec, done: true, doneAt: Date.now(), self: false }; save(); render(); finish(); return; }
      save(); render();
    }
  };
  setInterval(() => { const now = performance.now(), dt = Math.min(1, (now - lastTick) / 1000); lastTick = now; step(dt); }, 250);
  // for testing only: localStorage 'jla:debug' = '1' lets a test advance the clock by hand
  try { if (localStorage.getItem('jla:debug') === '1') window.__jlaReader = { step }; } catch (e) {}

  /* ---------- finishing: the finish card with badges just earned and what to read next ---------- */
  async function finish(again) {
    let index; try { index = await loadIndex(); } catch (e) { return; }
    const all = local.all(), weeks = local.weeks();
    const before = again ? [] : badges(index, { ...all, [slug]: { ...all[slug], done: false } }, weeks).filter((b) => b.earned).map((b) => b.id);
    const now = badges(index, all, weeks), fresh = now.filter((b) => b.earned && !before.includes(b.id));
    const next = suggest(index, all, { exclude: [slug] });
    let card = document.getElementById('finish');
    if (!card) { card = document.createElement('section'); card.id = 'finish'; card.className = 'finish-card'; (document.getElementById('footnotes') || text).after(card); }
    card.innerHTML = `
      <div class="fc-seal" aria-hidden="true">✓</div>
      <h2>You've read this article</h2>
      <p class="fc-sub">${local.me() ? 'It counts toward your stats and badges.' : 'It is saved in this browser. <a href="/account/">Sign in</a> to keep it and earn badges.'}</p>
      ${fresh.length ? `<h3>Badge${fresh.length > 1 ? 's' : ''} earned</h3><ul class="badge-list fresh">${fresh.map(badgeHtml).join('')}</ul>` : ''}
      ${next.length ? `<h3>Read next</h3><div class="next-list">${next.map((a) => cardHtml(a, all[a.slug])).join('')}</div>` : ''}
      <p class="fc-acts"><a class="btn sm alt" href="/account/">My library</a> <a class="btn sm alt" href="#share" data-sheet="share">Share it</a></p>`;
    if (!again) card.classList.add('pop');
  }
  if (rec.done) finish(true);

  connect(() => { // signed in: pick up progress from the account
    const r = local.get(slug); if (r) { (r.read || []).forEach((id) => read.add(id)); rec = { ...rec, ...r }; }
    paras.forEach((p) => { if (read.has(p.id)) p.el.classList.add('is-read'); });
    accLine(); render(); if (rec.done) finish(true); if (dirty) schedule();
  });
}
