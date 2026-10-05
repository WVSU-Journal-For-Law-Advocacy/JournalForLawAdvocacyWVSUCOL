/* Proofreading, on the article page.
   Everyone: a piece converted from the PDF shows "not yet proofread" until the board marks it done; that state is read
   straight from Firestore over HTTPS (no SDK), so the notice goes away as soon as an editor finishes.
   Editors (remembered on this device when they sign in): "Proofread this piece" in More turns on proofreading mode.
   A tap on a paragraph or footnote opens it for correction; each correction goes to the board's queue
   (/editor/proofread/), where it is applied in the CMS. */
import { local, esc } from './jla-core.js';

const J = () => window.JLA || { say() {}, Sheet: { open() {}, close() {} } };
const data = (() => { try { return JSON.parse(document.getElementById('share-data').textContent); } catch (e) { return {}; } })();
const slug = data.slug, text = document.getElementById('fulltext');
const notice = document.querySelector('[data-proof-notice]');
const cfg = (() => { try { return JSON.parse(document.getElementById('fb-config').textContent); } catch (e) { return null; } })();

// the notice: hidden once the piece is marked proofread
if (notice && slug && cfg && cfg.projectId) {
  fetch(`https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/(default)/documents/proofread/${encodeURIComponent(slug)}?key=${cfg.apiKey}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => { if (d && d.fields && d.fields.status && d.fields.status.stringValue === 'done') notice.hidden = true; })
    .catch(() => {});
}

const me = local.me();
if (text && slug && me && me.editor) {
  document.documentElement.classList.add('is-editor');
  let cloud = null, open = [], on = false, bar = null;
  const getCloud = async () => cloud || (cloud = await import('./jla-cloud.js'));
  const blocks = () => [...text.querySelectorAll('p[data-pid], li[data-pid], blockquote[data-pid]'), ...document.querySelectorAll('.footnotes li[id]')];
  const pidOf = (el) => el.dataset.pid || (el.id ? 'fn:' + el.id.replace(/^fn/, '') : '');
  // the paragraph as text, with its footnote markers written [^n] so a correction can be pasted back as it is
  const asText = (el) => {
    const c = el.cloneNode(true);
    c.querySelectorAll('.footnote-backref, .pc-bubble, .pc-add, .pr-mark').forEach((x) => x.remove());
    c.querySelectorAll('sup.footnote-ref').forEach((s) => { s.replaceWith(`[^${(s.textContent || '').replace(/\D/g, '')}]`); });
    c.querySelectorAll('em, i').forEach((x) => x.replaceWith(`*${x.textContent}*`));
    c.querySelectorAll('strong, b').forEach((x) => x.replaceWith(`**${x.textContent}**`));
    return c.textContent.replace(/\s+/g, ' ').trim();
  };

  const paintMarks = () => {
    document.querySelectorAll('.pr-mark').forEach((m) => m.remove());
    document.querySelectorAll('.pr-has').forEach((m) => m.classList.remove('pr-has'));
    if (!on) return;
    const by = {}; for (const c of open) by[c.pid] = (by[c.pid] || 0) + 1;
    for (const el of blocks()) {
      const n = by[pidOf(el)]; if (!n) continue;
      el.classList.add('pr-has');
      el.insertAdjacentHTML('afterbegin', `<span class="pr-mark" title="${n} suggested ${n === 1 ? 'correction' : 'corrections'}">${n}</span>`);
    }
    if (bar) bar.querySelector('[data-pr-count]').textContent = open.length ? `${open.length} open ${open.length === 1 ? 'correction' : 'corrections'}` : 'No corrections yet';
  };
  const refresh = async () => { const c = await getCloud(); open = (await c.corrections(slug).catch(() => [])).filter((x) => x.status === 'open'); paintMarks(); };

  async function start() {
    if (on) return; on = true; J().Sheet.close();
    document.body.classList.add('proofreading');
    bar = document.createElement('div'); bar.className = 'pr-bar'; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'Proofreading');
    bar.innerHTML = `<p><b>Proofreading</b> <span data-pr-count>Loading…</span><small>Tap a paragraph or footnote to correct it.</small></p>
      <div><button type="button" class="btn sm" data-pr-done>Mark proofread</button><button type="button" class="btn sm alt" data-pr-exit>Exit</button></div>`;
    document.body.appendChild(bar);
    bar.querySelector('[data-pr-exit]').addEventListener('click', stop);
    bar.querySelector('[data-pr-done]').addEventListener('click', finish);
    const c = await getCloud();
    const st = (await c.proofState().catch(() => ({})))[slug];
    if (!st || !st.status) c.setProofread(slug, 'in-progress').catch(() => {});
    refresh();
  }
  function stop() {
    on = false; document.body.classList.remove('proofreading'); if (bar) bar.remove(); bar = null; paintMarks();
    if (new URLSearchParams(location.search).has('proofread')) history.replaceState(null, '', location.pathname + location.hash);
  }
  async function finish() {
    const n = open.length;
    if (!confirm(n ? `Mark this piece proofread? ${n} ${n === 1 ? 'correction is' : 'corrections are'} still waiting to be applied in the CMS; they stay on the board.` : 'Mark this piece proofread? The "not yet proofread" notice will go away for readers.')) return;
    try { await (await getCloud()).setProofread(slug, 'done'); if (notice) notice.hidden = true; J().say('Marked proofread'); stop(); }
    catch (e) { J().say('Could not save. Please try again'); }
  }

  function correct(el) {
    const pid = pidOf(el), original = asText(el), mine = open.filter((c) => c.pid === pid);
    const node = document.createElement('div'); node.className = 'pr-sheet';
    node.innerHTML = `${mine.length ? `<div class="pr-prev"><b>Already suggested</b>${mine.map((c) => `<p>${esc(c.proposed)}<small>${esc(c.byName)}${c.note ? ' · ' + esc(c.note) : ''}</small></p>`).join('')}</div>` : ''}
      <label>Corrected text<textarea rows="8">${esc(original)}</textarea></label>
      <label>Note for the board (optional)<input type="text" maxlength="500" placeholder="e.g. paragraph break missing; footnote 12 belongs here"></label>
      <p class="pr-help">Fix only what differs from the printed PDF: missing or joined words, broken paragraphs, misplaced footnotes. Keep the [^n] markers.</p>
      <p class="acts"><button type="button" class="btn sm" data-save>Send correction</button></p>`;
    const ta = node.querySelector('textarea'), note = node.querySelector('input');
    node.querySelector('[data-save]').addEventListener('click', async (e) => {
      const proposed = ta.value.trim();
      if (proposed === original && !note.value.trim()) { J().say('Nothing changed'); return; }
      e.target.disabled = true;
      try { await (await getCloud()).proposeCorrection(slug, pid, original, proposed, note.value.trim()); J().Sheet.close(); J().say('Correction sent to the board'); refresh(); }
      catch (err) { e.target.disabled = false; J().say('Could not send. Please try again'); }
    });
    J().Sheet.open({ title: el.closest('.footnotes') ? 'Correct this footnote' : 'Correct this paragraph', node });
    setTimeout(() => ta.focus(), 250);
  }

  // in proofreading mode a tap corrects (and does not open the discussion)
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-proofread-on]')) { e.preventDefault(); start(); return; }
    if (!on || e.target.closest('.pr-bar, .sheet, a, button')) return;
    const el = e.target.closest('#fulltext p[data-pid], #fulltext li[data-pid], #fulltext blockquote[data-pid], .footnotes li[id]');
    if (!el) return;
    const sel = getSelection(); if (sel && !sel.isCollapsed) return;
    e.preventDefault(); e.stopPropagation(); correct(el);
  }, true);

  if (new URLSearchParams(location.search).has('proofread')) start();
}
