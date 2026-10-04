/* Paragraph comments (Webnovel-style). A small bubble ends each paragraph; tap it to open the thread.
   Reading needs no account; posting, liking, replying and reporting need sign-in.
   Comments go live at once; readers can report, and editors (editors/{uid}) can hide or delete. */
import { local, esc } from './jla-core.js';

const text = document.getElementById('fulltext');
const dataEl = document.getElementById('share-data');
const slug = dataEl ? JSON.parse(dataEl.textContent).slug : null;
const J = () => window.JLA || { say() {}, Sheet: { open() {}, close() {}, isOpen: () => false } };
const FLAGS = 'jla:flags';

let cloud, counts = {}, cloudReady = false;
const icon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14v10H9l-4 4z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>';
const ago = (ms) => { const s = (Date.now() - ms) / 1000; if (s < 60) return 'just now'; if (s < 3600) return `${Math.floor(s / 60)}m`; if (s < 86400) return `${Math.floor(s / 3600)}h`; if (s < 2592000) return `${Math.floor(s / 86400)}d`; return new Date(ms).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }); };
const initials = (n) => String(n || '?').split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
const avatar = (c) => /^data:image\/|^https:\/\//.test(c.thumb || '') ? `<img class="cm-av" src="${esc(c.thumb)}" alt="" width="32" height="32">` : `<span class="cm-av">${esc(initials(c.name))}</span>`;

/* ---------- count pills: only on paragraphs that have comments ---------- */
function bubbleFor(el) {
  const n = counts[el.dataset.pid] || 0;
  let b = el.querySelector(':scope > .pc-bubble');
  if (!n) { if (b) b.remove(); return null; }
  if (!b) { b = document.createElement('button'); b.type = 'button'; b.className = 'pc-bubble has'; el.append(b); }
  b.innerHTML = `${icon}<span>${n}</span>`;
  b.setAttribute('aria-label', `${n} comment${n > 1 ? 's' : ''} on this paragraph`);
  return b;
}
const paras = () => [...text.querySelectorAll('p[data-pid], li[data-pid], blockquote[data-pid]')];
const total = () => Object.values(counts).reduce((a, b) => a + b, 0);
function drawBubbles() {
  paras().forEach(bubbleFor);
  const d = document.querySelector('[data-dock="discussion"]'); if (!d) return;
  d.hidden = false; const n = d.querySelector('.dk-n'); n.hidden = !total(); n.textContent = total();
}

/* ---------- tap a paragraph to comment: one small chip at its end ---------- */
let addChip, addTimer;
function offerComment(el) {
  if (!addChip) {
    addChip = document.createElement('button'); addChip.type = 'button'; addChip.className = 'pc-add';
    addChip.innerHTML = `${icon}Comment`;
    addChip.addEventListener('click', (e) => { e.stopPropagation(); const pid = addChip.parentElement && addChip.parentElement.dataset.pid; addChip.remove(); if (pid) openThread(pid); });
  }
  el.append(addChip); clearTimeout(addTimer); addTimer = setTimeout(() => addChip.remove(), 6000);
}
addEventListener('scroll', () => { if (addChip && addChip.isConnected && !addChip.matches(':hover')) { clearTimeout(addTimer); addTimer = setTimeout(() => addChip.remove(), 900); } }, { passive: true });

/* ---------- the Discussion list (from the dock) ---------- */
function openDiscussion() {
  const live = paras().filter((el) => counts[el.dataset.pid]);
  const excerpt = (el) => { const c = el.cloneNode(true); c.querySelectorAll('sup, .footnote-ref, .pc-bubble, .pc-add').forEach((x) => x.remove()); const t = c.textContent.replace(/\s+/g, ' ').trim(); return t.length > 140 ? t.slice(0, 140) + '…' : t; };
  const node = document.createElement('div'); node.className = 'disc-list';
  node.innerHTML = live.length
    ? `<ul>${live.map((el) => `<li><button type="button" data-pid="${el.dataset.pid}"><span class="dl-q">${esc(excerpt(el))}</span><span class="dl-n">${icon}${counts[el.dataset.pid]}</span></button></li>`).join('')}</ul>`
    : '<p class="off">No discussion yet. Tap any paragraph, or select a sentence, and choose <b>Comment</b> to start one.</p>';
  node.addEventListener('click', (e) => { const b = e.target.closest('[data-pid]'); if (b) openThread(b.dataset.pid); });
  J().Sheet.open({ title: total() ? `Discussion · ${total()}` : 'Discussion', node });
}

/* ---------- the thread ---------- */
let me = null, editor = false, current = null; // current = { pid, list, replyTo }
async function ensureCloud() {
  if (cloud) return cloud;
  const mod = await import('./jla-cloud.js'); if (!mod.enabled) return null;
  await new Promise((ok) => { let first = true; mod.onUser(async (u) => { me = u; editor = u ? await mod.isEditor() : false; if (first) { first = false; ok(); } else if (current) render(); }); });
  cloud = mod; return mod;
}
async function myThumb() {
  // a small avatar for comments: the profile thumb, else the Google photo, else made from the profile photo
  const p = await cloud.getProfile(me.uid).catch(() => null) || {};
  if (p.thumb) return { name: p.name || me.displayName, thumb: p.thumb };
  let thumb = me.photoURL || '';
  if (p.photo && p.photo.startsWith('data:image/')) {
    try {
      const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = p.photo; });
      const cv = document.createElement('canvas'); cv.width = cv.height = 64; cv.getContext('2d').drawImage(img, 0, 0, 64, 64);
      thumb = cv.toDataURL('image/jpeg', 0.75); cloud.saveProfile({ thumb }).catch(() => {});
    } catch (e) {}
  }
  return { name: p.name || me.displayName || 'Reader', thumb };
}

async function openThread(pid) {
  const el = text.querySelector(`[data-pid="${pid}"]`); if (!el) return;
  const quote = el.cloneNode(true); quote.querySelectorAll('sup, .footnote-ref, .pc-bubble, .pc-add, mark').forEach((x) => x.replaceWith(...(x.matches('mark') ? x.childNodes : [])));
  const q = quote.textContent.replace(/\s+/g, ' ').trim();
  const node = document.createElement('div'); node.className = 'thread';
  node.innerHTML = `<blockquote class="th-quote">${esc(q.length > 220 ? q.slice(0, 220) + '…' : q)}</blockquote><div class="th-list"><p class="off">Loading the discussion…</p></div><div class="th-compose"></div>`;
  current = { pid, list: [], replyTo: null, node };
  J().Sheet.open({ title: 'Discussion', node, closeHook: () => { current = null; } });
  node.addEventListener('click', onThreadClick);
  try {
    const c = await ensureCloud(); if (!c) { node.querySelector('.th-list').innerHTML = '<p class="off">Comments are not available yet.</p>'; return; }
    current.list = await c.loadComments(slug, pid, { editor });
  } catch (e) { node.querySelector('.th-list').innerHTML = '<p class="off">Could not load the discussion. Please try again.</p>'; return; }
  render();
}

function render() {
  if (!current) return;
  const { node, list } = current;
  const live = list.filter((c) => editor || !c.hidden);
  const top = live.filter((c) => !c.parent).sort((a, b) => (b.likedBy || []).length - (a.likedBy || []).length || a.created - b.created);
  const replies = (id) => live.filter((c) => c.parent === id).sort((a, b) => a.created - b.created);
  const one = (c, isReply) => {
    const liked = me && (c.likedBy || []).includes(me.uid), n = (c.likedBy || []).length;
    const mine = me && c.uid === me.uid;
    return `<article class="cm${isReply ? ' reply' : ''}${c.hidden ? ' is-hidden' : ''}" data-id="${c.id}">
      ${avatar(c)}<div class="cm-body">
        <p class="cm-head"><b>${esc(c.name)}</b><span>${ago(c.created)}</span>${c.hidden ? '<em>hidden</em>' : ''}</p>
        <p class="cm-text">${esc(c.text)}</p>
        <p class="cm-acts">
          <button type="button" data-a="like" aria-pressed="${!!liked}">${liked ? '♥' : '♡'} ${n || ''}</button>
          ${!isReply ? '<button type="button" data-a="reply">Reply</button>' : ''}
          ${!mine ? '<button type="button" data-a="report">Report</button>' : ''}
          ${mine || editor ? '<button type="button" data-a="delete">Delete</button>' : ''}
          ${editor ? `<button type="button" data-a="hide">${c.hidden ? 'Restore' : 'Hide'}</button>` : ''}
        </p></div></article>`;
  };
  node.querySelector('.th-list').innerHTML = top.length
    ? top.map((c) => one(c) + replies(c.id).map((r) => one(r, true)).join('')).join('')
    : '<p class="off th-empty">No comments on this paragraph yet. Start the discussion.</p>';
  const box = node.querySelector('.th-compose');
  if (!me) {
    box.innerHTML = `<p class="th-signin">Sign in to join the discussion. <a class="btn sm" href="/account/">Sign in</a></p>`;
  } else {
    const to = current.replyTo && live.find((c) => c.id === current.replyTo);
    box.innerHTML = `<form class="th-form">
      ${to ? `<p class="th-to">Replying to <b>${esc(to.name)}</b> <button type="button" data-a="cancel-reply" aria-label="Cancel reply">✕</button></p>` : ''}
      <label for="th-t" class="sr">Your comment</label>
      <textarea id="th-t" maxlength="1000" rows="3" required placeholder="${to ? 'Write a reply…' : 'Add to the discussion…'}"></textarea>
      <p class="th-foot"><a href="/community/">Community guidelines</a><span class="th-n">0/1000</span><button class="btn sm" type="submit">Post</button></p></form>`;
    const ta = box.querySelector('textarea'), n = box.querySelector('.th-n');
    ta.addEventListener('input', () => { n.textContent = `${ta.value.length}/1000`; });
    box.querySelector('form').addEventListener('submit', post);
    if (to) ta.focus();
  }
}

async function post(e) {
  e.preventDefault(); const f = e.target, ta = f.querySelector('textarea'), btn = f.querySelector('[type=submit]');
  const t = ta.value.trim(); if (!t) return;
  btn.disabled = true;
  try {
    const who = await myThumb();
    const id = await cloud.addComment({ slug, pid: current.pid, text: t, parent: current.replyTo, name: who.name, thumb: who.thumb });
    if (current.replyTo && cloud.pushConfigured()) cloud.callFunction('push-reply', { commentId: id }).catch(() => {}); // tell the person you replied to
    current.list.push({ id, slug, pid: current.pid, uid: me.uid, name: who.name, thumb: who.thumb, text: t, parent: current.replyTo, created: Date.now(), hidden: false, likedBy: [] });
    current.replyTo = null; counts[current.pid] = (counts[current.pid] || 0) + 1;
    drawBubbles();
    try { const fl = JSON.parse(localStorage.getItem(FLAGS) || '{}'); if (!fl.commented) { fl.commented = Date.now(); localStorage.setItem(FLAGS, JSON.stringify(fl)); J().say('Badge earned: Amicus Curiae'); } } catch (err) {}
    render();
  } catch (err) { J().say('Could not post. Please try again'); btn.disabled = false; }
}

async function onThreadClick(e) {
  const b = e.target.closest('[data-a]'); if (!b || !current) return;
  if (b.dataset.a === 'cancel-reply') { current.replyTo = null; return render(); }
  const id = b.closest('[data-id]') && b.closest('[data-id]').dataset.id; const c = current.list.find((x) => x.id === id); if (!c) return;
  if (!me) return J().say('Sign in to take part');
  try {
    if (b.dataset.a === 'like') {
      const liked = !(c.likedBy || []).includes(me.uid);
      c.likedBy = liked ? [...(c.likedBy || []), me.uid] : (c.likedBy || []).filter((x) => x !== me.uid); render();
      await cloud.toggleLike(c.id, liked);
    }
    if (b.dataset.a === 'reply') { current.replyTo = c.id; render(); }
    if (b.dataset.a === 'report') {
      const reason = prompt('Why should the editors look at this comment? (optional)', ''); if (reason === null) return;
      await cloud.reportComment(c, reason); J().say('Thank you. The editors will review it');
    }
    if (b.dataset.a === 'delete') {
      if (!confirm('Delete this comment?')) return;
      await cloud.deleteComment(c); current.list = current.list.filter((x) => x.id !== c.id && x.parent !== c.id);
      if (!c.hidden) { counts[c.pid] = Math.max(0, (counts[c.pid] || 1) - 1); drawBubbles(); }
      render();
    }
    if (b.dataset.a === 'hide') {
      await cloud.setHidden(c, !c.hidden); c.hidden = !c.hidden;
      counts[c.pid] = Math.max(0, (counts[c.pid] || 0) + (c.hidden ? -1 : 1)); drawBubbles();
      render();
    }
  } catch (err) { J().say('That did not go through. Please try again'); }
}

/* ---------- start ---------- */
if (text && slug) {
  (async () => {
    const mod = await import('./jla-cloud.js'); if (!mod.enabled) return;
    cloudReady = true;
    try { counts = await mod.threadCounts(slug); } catch (e) { counts = {}; }
    // opened from a notification: ?thread=<paragraph> goes straight to that discussion
    const th = new URLSearchParams(location.search).get('thread');
    if (th) { const el = text.querySelector('[data-pid="' + CSS.escape(th) + '"]'); if (el) { el.scrollIntoView({ block: 'center' }); setTimeout(() => openThread(th), 400); } }
    drawBubbles();
    if (local.me()) ensureCloud(); // signed-in readers: get ready to post
  })();
  text.addEventListener('click', (e) => {
    const b = e.target.closest('.pc-bubble'); if (b) { e.preventDefault(); return openThread(b.parentElement.dataset.pid); }
    // a plain tap on a paragraph (not a link, footnote, highlight or a text selection) offers 'Comment'
    if (e.target.closest('a, sup, mark, button, .pc-add')) return;
    const sel = getSelection(); if (sel && !sel.isCollapsed) return;
    const el = e.target.closest('p[data-pid], li[data-pid], blockquote[data-pid]'); if (el && cloudReady) offerComment(el);
  });
  document.addEventListener('jla:comment', (e) => { if (e.detail && e.detail.pid) openThread(e.detail.pid); });
  document.addEventListener('click', (e) => { if (e.target.closest('[data-dock="discussion"]')) openDiscussion(); });
}
