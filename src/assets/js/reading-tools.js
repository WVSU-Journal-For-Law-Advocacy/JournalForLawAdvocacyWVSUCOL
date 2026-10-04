/* Reading tools on article pages: display settings (Aa), focus mode, Listen (read aloud),
   "continue where you left off", and highlights & notes (saved to the reader's account). */
import { local, esc } from './jla-core.js';

const text = document.getElementById('fulltext');
const dataEl = document.getElementById('share-data');
const slug = dataEl ? JSON.parse(dataEl.textContent).slug : null;
const root = document.documentElement;
const J = () => window.JLA || { say() {}, Sheet: { open() {}, close() {} } }; // from site.js
const bar = document.querySelector('.read-tools');

/* ---------- display settings ---------- */
const PREFS = 'jla:prefs';
const defaults = { size: 3, lead: 2, theme: '', width: 'comfy' };
const getPrefs = () => { try { return { ...defaults, ...JSON.parse(localStorage.getItem(PREFS) || '{}') }; } catch (e) { return { ...defaults }; } };
let prefs = getPrefs();
function apply() {
  root.style.setProperty('--rs', [0.88, 0.94, 1, 1.08, 1.18][prefs.size - 1] || 1);
  root.style.setProperty('--rl', [1.6, 1.75, 1.95][prefs.lead - 1] || 1.75);
  root.classList.toggle('reading-wide', prefs.width === 'wide');
  root.classList.toggle('reading-sepia', prefs.theme === 'sepia');
  if (prefs.theme === 'night' || prefs.theme === 'paper' || prefs.theme === 'sepia') {
    root.dataset.theme = prefs.theme === 'night' ? 'dark' : 'light';
    try { localStorage.setItem('jla-theme', root.dataset.theme); } catch (e) {}
  }
}
function savePrefs(p) {
  prefs = { ...prefs, ...p }; apply();
  try { localStorage.setItem(PREFS, JSON.stringify(prefs)); } catch (e) {}
  if (cloud) cloud.saveProfile({ prefs }).catch(() => {});
}
if (text) apply();

const seg = (name, label, opts) => `<fieldset class="rt-seg"><legend>${label}</legend><div>${opts.map(([v, l]) =>
  `<button type="button" data-pref="${name}" data-v="${v}" aria-pressed="${String(prefs[name]) === String(v) || (name === 'theme' && !prefs.theme && v === (root.dataset.theme === 'dark' ? 'night' : 'paper'))}">${l}</button>`).join('')}</div></fieldset>`;
function openSettings() {
  const node = document.createElement('div'); node.className = 'rt-settings';
  node.innerHTML = seg('size', 'Text size', [[1, '<span style="font-size:.8em">A</span>'], [2, '<span style="font-size:.9em">A</span>'], [3, 'A'], [4, '<span style="font-size:1.15em">A</span>'], [5, '<span style="font-size:1.3em">A</span>']])
    + seg('lead', 'Line spacing', [[1, 'Tight'], [2, 'Normal'], [3, 'Airy']])
    + seg('theme', 'Page', [['paper', 'Paper'], ['sepia', 'Sepia'], ['night', 'Night']])
    + seg('width', 'Column', [['comfy', 'Comfortable'], ['wide', 'Wide']])
    + '<p class="rt-row"><button class="btn sm alt" type="button" data-focus-on>Focus mode</button></p>';
  node.addEventListener('click', (e) => {
    const b = e.target.closest('[data-pref]');
    if (b) {
      const v = /^\d+$/.test(b.dataset.v) ? +b.dataset.v : b.dataset.v;
      savePrefs({ [b.dataset.pref]: v });
      node.querySelectorAll(`[data-pref="${b.dataset.pref}"]`).forEach((x) => x.setAttribute('aria-pressed', x === b));
    }
    if (e.target.closest('[data-focus-on]')) { J().Sheet.close(); focus(true); }
  });
  J().Sheet.open({ title: 'Display', node });
}

/* ---------- focus mode ---------- */
let exitBtn;
function focus(on) {
  root.classList.toggle('focus-mode', on);
  if (on && !exitBtn) {
    exitBtn = document.createElement('button'); exitBtn.type = 'button'; exitBtn.className = 'focus-exit'; exitBtn.textContent = 'Exit focus';
    exitBtn.addEventListener('click', () => focus(false)); document.body.append(exitBtn);
  }
  if (exitBtn) exitBtn.hidden = !on;
  if (on) J().say('Focus mode: press Esc to leave');
}
addEventListener('keydown', (e) => { if (e.key === 'Escape' && root.classList.contains('focus-mode')) focus(false); });

/* ---------- Listen: read aloud, paragraph by paragraph ---------- */
const synth = window.speechSynthesis;
let player, queue = [], qi = 0, speaking = false, rate = 1;
const paraEls = () => [...text.querySelectorAll('[data-pid]')];
const cleanText = (el) => { const c = el.cloneNode(true); c.querySelectorAll('sup, .footnote-ref').forEach((x) => x.remove()); return c.textContent.replace(/\s+/g, ' ').trim(); };
const sentences = (t) => t.match(/[^.!?]+[.!?]+["”’)]*\s*|[^.!?]+$/g) || [t]; // short pieces: some voices stop after ~15 s
function voice() {
  const vs = synth.getVoices(); return vs.find((v) => /en-PH/i.test(v.lang)) || vs.find((v) => /^en/i.test(v.lang) && /Google|Natural|Samantha|Daniel/i.test(v.name)) || vs.find((v) => /^en/i.test(v.lang));
}
function speakPara(i) {
  const els = paraEls(); if (i >= els.length) return stopListen();
  qi = i; els.forEach((x) => x.classList.remove('speaking'));
  const el = els[i]; el.classList.add('speaking');
  el.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  queue = sentences(cleanText(el)); synth.cancel();
  queue.forEach((s, k) => {
    const u = new SpeechSynthesisUtterance(s); const v = voice(); if (v) u.voice = v; u.rate = rate; u.lang = (v && v.lang) || 'en-US';
    if (k === queue.length - 1) u.onend = () => { if (speaking) speakPara(qi + 1); };
    synth.speak(u);
  });
  updatePlayer();
}
function startListen() {
  if (!player) buildPlayer();
  player.hidden = false; speaking = true;
  // start from the first paragraph on screen
  const els = paraEls(); const i = Math.max(0, els.findIndex((x) => x.getBoundingClientRect().bottom > 80));
  speakPara(i);
}
function stopListen() {
  speaking = false; synth.cancel(); paraEls().forEach((x) => x.classList.remove('speaking'));
  if (player) player.hidden = true;
}
function buildPlayer() {
  player = document.createElement('div'); player.className = 'listen-bar'; player.setAttribute('role', 'region'); player.setAttribute('aria-label', 'Listen');
  player.innerHTML = `<button type="button" data-l="prev" aria-label="Previous paragraph">⏮</button>
    <button type="button" data-l="play" aria-label="Pause">❚❚</button>
    <button type="button" data-l="next" aria-label="Next paragraph">⏭</button>
    <button type="button" data-l="rate" aria-label="Speed">1×</button>
    <button type="button" data-l="close" aria-label="Stop listening">✕</button>`;
  player.addEventListener('click', (e) => {
    const b = e.target.closest('[data-l]'); if (!b) return;
    const a = b.dataset.l;
    if (a === 'play') { if (speaking) { speaking = false; synth.pause(); } else { speaking = true; if (synth.paused) synth.resume(); else speakPara(qi); } updatePlayer(); }
    if (a === 'prev') { speaking = true; speakPara(Math.max(0, qi - 1)); }
    if (a === 'next') { speaking = true; speakPara(qi + 1); }
    if (a === 'rate') { const rs = [0.8, 1, 1.2, 1.5]; rate = rs[(rs.indexOf(rate) + 1) % rs.length]; b.textContent = rate + '×'; if (speaking) speakPara(qi); }
    if (a === 'close') stopListen();
  });
  document.body.append(player);
}
function updatePlayer() { if (!player) return; const p = player.querySelector('[data-l=play]'); p.textContent = speaking ? '❚❚' : '▶'; p.setAttribute('aria-label', speaking ? 'Pause' : 'Play'); }
addEventListener('pagehide', () => synth && synth.cancel());

/* ---------- continue where you left off ---------- */
function offerResume() {
  const p = local.get(slug); if (!p || p.done || !p.at || !(p.pct > 0)) return;
  const el = text.querySelector(`[data-pid="${p.at}"]`); if (!el || scrollY > 300) return;
  const chip = document.createElement('button'); chip.type = 'button'; chip.className = 'resume-chip';
  chip.innerHTML = `Continue where you left off <span>${Math.round(p.pct)}% read ↓</span>`;
  chip.addEventListener('click', () => { const next = el.nextElementSibling || el; scrollTo({ top: next.getBoundingClientRect().top + scrollY - 90, behavior: 'smooth' }); chip.remove(); });
  document.body.append(chip);
  const gone = () => { if (scrollY > 600) { chip.remove(); removeEventListener('scroll', gone); } };
  addEventListener('scroll', gone, { passive: true }); setTimeout(() => chip.remove(), 15000);
}

/* ---------- highlights & notes (signed-in readers) ---------- */
let cloud = null, marks = [];
// wrap the highlighted words inside paragraph `pid`, matching text with footnote numbers left out
function paint(h) {
  const el = text.querySelector(`[data-pid="${h.pid}"]`); if (!el) return;
  const nodes = []; const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: (n) => n.parentElement.closest('sup, .footnote-ref') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  let full = '', n; while ((n = walk.nextNode())) { nodes.push([n, full.length]); full += n.data; }
  const norm = (s) => s.replace(/\s+/g, ' ');
  // map positions in the whitespace-collapsed text back to the raw text
  const map = []; let flat = ''; for (let i = 0; i < full.length; i++) { const c = /\s/.test(full[i]) ? ' ' : full[i]; if (c === ' ' && flat.endsWith(' ')) continue; map.push(i); flat += c; }
  const at = flat.indexOf(norm(h.text).trim()); if (at < 0) return;
  const start = map[at], end = map[at + norm(h.text).trim().length - 1] + 1;
  for (const [node, off] of nodes) {
    const s = Math.max(start, off), e = Math.min(end, off + node.data.length); if (s >= e) continue;
    const r = document.createRange(); r.setStart(node, s - off); r.setEnd(node, e - off);
    const m = document.createElement('mark'); m.className = 'hl' + (h.note ? ' has-note' : ''); m.dataset.hid = h.id;
    try { r.surroundContents(m); } catch (err) {}
  }
}
const unpaint = (id) => text.querySelectorAll(`mark[data-hid="${id}"]`).forEach((m) => m.replaceWith(...m.childNodes));

async function onHighlight(e) {
  const { text: t, pid, note } = e.detail;
  if (!cloud) {
    J().Sheet.open({ title: note ? 'Add a note' : 'Highlight', html: `<p class="off">Sign in to save highlights and notes to My library, on any device.</p><p class="acts" style="justify-content:center"><a class="btn" href="/account/">Sign in</a></p>` });
    return;
  }
  const h = { slug, pid, text: t.slice(0, 500), note: '' };
  if (note) return editNote(h, true);
  try { h.id = await cloud.addHighlight(h); marks.push(h); paint(h); J().say('Highlighted. See it in My library'); }
  catch (err) { J().say('Could not save the highlight'); }
}
function editNote(h, isNew) {
  const node = document.createElement('form'); node.className = 'note-form';
  node.innerHTML = `<blockquote>${esc(h.text)}</blockquote>
    <label for="note-t" class="sr">Note</label><textarea id="note-t" maxlength="1000" rows="4" placeholder="Your note (only you can see it)">${esc(h.note || '')}</textarea>
    <p class="acts"><button class="btn sm" type="submit">Save</button>${isNew ? '' : '<button class="btn sm alt" type="button" data-del>Remove highlight</button>'}</p>`;
  node.addEventListener('submit', async (ev) => {
    ev.preventDefault(); const note = node.querySelector('textarea').value.trim().slice(0, 1000);
    try {
      if (isNew) { h.note = note; h.id = await cloud.addHighlight(h); marks.push(h); paint(h); }
      else { await cloud.updateHighlight(h.id, { note }); h.note = note; unpaint(h.id); paint(h); }
      J().Sheet.close(); J().say('Note saved');
    } catch (err) { J().say('Could not save the note'); }
  });
  node.addEventListener('click', async (ev) => {
    if (!ev.target.closest('[data-del]')) return;
    try { await cloud.deleteHighlight(h.id); unpaint(h.id); marks = marks.filter((x) => x.id !== h.id); J().Sheet.close(); J().say('Highlight removed'); }
    catch (err) { J().say('Could not remove it'); }
  });
  J().Sheet.open({ title: isNew ? 'Add a note' : 'Your highlight', node });
  setTimeout(() => node.querySelector('textarea').focus(), 60);
}

/* ---------- start ---------- */
if (text && slug) {
  if (bar) {
    bar.hidden = false;
    bar.addEventListener('click', (e) => {
      const b = e.target.closest('[data-tool]'); if (!b) return;
      if (b.dataset.tool === 'display') openSettings();
      if (b.dataset.tool === 'focus') focus(!root.classList.contains('focus-mode'));
      if (b.dataset.tool === 'listen') (speaking ? stopListen : startListen)();
    });
    if (!synth || !window.SpeechSynthesisUtterance) bar.querySelector('[data-tool=listen]').hidden = true;
  }
  setTimeout(offerResume, 600); // after reader.js has numbered the paragraphs
  document.addEventListener('jla:highlight', onHighlight);
  text.addEventListener('click', (e) => {
    const m = e.target.closest('mark.hl'); if (!m) return;
    const h = marks.find((x) => x.id === m.dataset.hid); if (h) editNote(h, false);
  });
  (async () => {
    const mod = await import('./jla-cloud.js');
    if (!mod.enabled || !local.me()) return;
    mod.onUser(async (u) => {
      if (!u) { cloud = null; return; }
      cloud = mod;
      try {
        const p = await mod.getProfile(u.uid);
        if (p && p.prefs && !localStorage.getItem(PREFS)) { prefs = { ...defaults, ...p.prefs }; apply(); try { localStorage.setItem(PREFS, JSON.stringify(prefs)); } catch (e) {} }
        marks = await mod.loadHighlights(slug); marks.forEach(paint);
      } catch (e) {}
    });
  })();
}
