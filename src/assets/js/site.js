const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const root = document.documentElement;

/* toast */
const toast = $('#toast');
let tt;
const say = (m) => { toast.textContent = m; toast.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => toast.classList.remove('on'), 2200); };

const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* theme toggle (several buttons share the class .tb) */
const label = () => {
  const d = root.dataset.theme === 'dark';
  $$('.tb').forEach((b) => { b.setAttribute('aria-pressed', d); b.setAttribute('aria-label', d ? 'Switch to light mode' : 'Switch to dark mode'); });
};
$$('.tb').forEach((b) => b.addEventListener('click', () => {
  root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
  store.set('jla-theme', root.dataset.theme);
  label();
}));
label();

/* dismissible announcement ribbon (remembered per announcement text) */
const ribbon = $('#ribbon');
if (ribbon) {
  const key = 'jla-ribbon-' + ribbon.dataset.key;
  if (store.get(key)) ribbon.hidden = true;
  $('.x', ribbon).addEventListener('click', () => { ribbon.hidden = true; store.set(key, '1'); });
}

/* signed-in readers see their photo (or initials) in the header (set by the account scripts) */
const acctBtn = $('.acct-btn');
if (acctBtn) {
  let me = null; try { me = JSON.parse(store.get('jla:me')); } catch (e) {}
  if (me && me.name) {
    acctBtn.classList.add('is-me'); acctBtn.setAttribute('aria-label', `My library (${me.name})`);
    const ini = me.name.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
    acctBtn.innerHTML = /^data:image\/|^https:\/\//.test(me.photo || '') ? `<img src="${me.photo.replace(/"/g, '')}" alt="" width="30" height="30">` : `<span class="ini">${ini}</span>`;
  }
}

/* scroll lock that keeps the reader's place (works on iOS too) */
let lockedY = 0;
const lockScroll = () => { if (document.body.classList.contains('locked')) return; lockedY = scrollY; document.body.style.top = `-${lockedY}px`; document.body.classList.add('locked'); };
const unlockScroll = () => { if (!document.body.classList.contains('locked')) return; document.body.classList.remove('locked'); document.body.style.top = ''; root.style.scrollBehavior = 'auto'; scrollTo(0, lockedY); root.style.scrollBehavior = ''; };

/* full-screen menu sheet */const menuBtn = $('#menu'), menuSheet = $('#menusheet');
const openMenu = () => {
  menuSheet.hidden = false; lockScroll();
  requestAnimationFrame(() => menuSheet.classList.add('open'));
  menuBtn.setAttribute('aria-expanded', 'true');
  const first = $('nav a', menuSheet); if (first) first.focus({ preventScroll: true });
};
const closeMenu = () => {
  menuSheet.classList.remove('open'); unlockScroll();
  menuBtn.setAttribute('aria-expanded', 'false');
  setTimeout(() => { menuSheet.hidden = true; }, reduceMotion ? 0 : 250);
  menuBtn.focus({ preventScroll: true });
};
if (menuBtn && menuSheet) {
  menuBtn.addEventListener('click', openMenu);
  $$('[data-close-menu]', menuSheet).forEach((b) => b.addEventListener('click', closeMenu));
  menuSheet.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
    if (e.key === 'Tab') { // keep focus inside the sheet
      const f = $$('a,button,input', menuSheet).filter((x) => x.offsetParent);
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });
}

/* footer groups: open on wide screens, collapsed on phones */
if (matchMedia('(max-width: 767px)').matches) $$('.foot-cols details').forEach((d) => { d.open = false; });

/* reading progress + header that hides on scroll down, returns on scroll up */
const bar = $('#bar'), head = $('#sitehead'), actionbar = $('.actionbar');
let lastY = scrollY, ticking = false;
addEventListener('scroll', () => {
  if (ticking) return; ticking = true;
  requestAnimationFrame(() => {
    const y = scrollY, max = Math.max(1, root.scrollHeight - root.clientHeight);
    bar.style.transform = `scaleX(${y / max})`;
    const down = y > lastY + 4, up = y < lastY - 4;
    if (head && !document.body.classList.contains('locked')) {
      if (down && y > 160) head.classList.add('is-hidden');
      else if (up || y < 80) head.classList.remove('is-hidden');
    }
    if (actionbar) { if (down && y > 300) actionbar.classList.add('is-hidden'); else if (up) actionbar.classList.remove('is-hidden'); }
    lastY = y; ticking = false;
  });
}, { passive: true });

/* copy citation / caption / link */
const copy = (text, done, fallbackEl) =>
  (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => say(done), () => {
    if (!fallbackEl) return say(text);
    const r = document.createRange(); r.selectNodeContents(fallbackEl);
    getSelection().removeAllRanges(); getSelection().addRange(r); say('Press Ctrl+C to copy');
  });
document.addEventListener('click', (e) => {
  const c = e.target.closest('[data-copy]');
  if (c) { const el = $(c.dataset.copy); return copy(el.innerText.trim(), c.dataset.copyMsg || 'Citation copied', el); }
  const l = e.target.closest('[data-copy-link]');
  if (l) copy(location.href.split('#')[0], 'Link copied');
});

/* ---------- sheet: one reusable bottom sheet (phones) / dialog (wider) ---------- */
const Sheet = (() => {
  let el, backdrop, body, titleEl, lastFocus, onClose;
  const build = () => {
    backdrop = document.createElement('div'); backdrop.className = 'sheet-backdrop'; backdrop.hidden = true;
    el = document.createElement('div'); el.className = 'sheet'; el.hidden = true;
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'sheet-title');
    el.innerHTML = '<div class="grip" aria-hidden="true"></div><div class="sheet-head"><h2 id="sheet-title"></h2><button class="icon-btn" type="button" data-sheet-close aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button></div><div class="sheet-body"></div>';
    document.body.append(backdrop, el);
    body = $('.sheet-body', el); titleEl = $('#sheet-title', el);
    backdrop.addEventListener('click', close);
    el.addEventListener('click', (e) => { if (e.target.closest('[data-sheet-close]')) close(); });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
      if (e.key === 'Tab') {
        const f = $$('a[href],button:not([hidden]),input,[tabindex]:not([tabindex="-1"])', el).filter((x) => x.offsetParent);
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    });
    // swipe down to close (phones)
    let y0 = null;
    el.addEventListener('touchstart', (e) => { y0 = el.scrollTop <= 0 ? e.touches[0].clientY : null; }, { passive: true });
    el.addEventListener('touchmove', (e) => { if (y0 === null) return; const dy = e.touches[0].clientY - y0; if (dy > 0) el.style.transform = `translateY(${dy}px)`; }, { passive: true });
    el.addEventListener('touchend', (e) => {
      if (y0 === null) return; const dy = e.changedTouches[0].clientY - y0; el.style.transform = ''; y0 = null;
      if (dy > 90) close();
    });
  };
  function open({ title, node, html, closeHook }) {
    if (!el) build();
    if (isOpen()) close(true);
    lastFocus = document.activeElement; onClose = closeHook;
    titleEl.textContent = title || '';
    body.replaceChildren(); if (node) body.append(node); else body.innerHTML = html || '';
    el.hidden = false; backdrop.hidden = false; lockScroll();
    requestAnimationFrame(() => { el.classList.add('open'); backdrop.classList.add('open'); });
    setTimeout(() => $('[data-sheet-close]', el).focus({ preventScroll: true }), 30);
  }
  function close(instant) {
    if (!isOpen()) return;
    el.classList.remove('open'); backdrop.classList.remove('open'); unlockScroll();
    const done = () => { el.hidden = true; backdrop.hidden = true; if (onClose) { const h = onClose; onClose = null; h(); } };
    if (instant === true || reduceMotion) done(); else setTimeout(done, 280);
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  const isOpen = () => el && !el.hidden;
  const setBody = (title, html) => { titleEl.textContent = title; body.innerHTML = html; };
  return { open, close, isOpen, setBody };
})();

/* Cite / Share open in the sheet: the in-page section is moved in, and put back on close */
const sheetSections = { cite: 'Cite this article', share: 'Share' };
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-sheet]'); if (!t) return;
  const sec = document.getElementById(t.dataset.sheet); if (!sec) return;
  e.preventDefault();
  const marker = document.createComment('sheet-slot'); sec.before(marker);
  const heading = $('h2', sec); if (heading) heading.hidden = true;
  Sheet.open({ title: sheetSections[t.dataset.sheet], node: sec, closeHook: () => { marker.replaceWith(sec); if (heading) heading.hidden = false; } });
});

/* the reading dock: Contents and More open as sheets (Display, Listen, Discuss and progress are handled by the modules) */
const fromTemplate = (id) => { const t = document.getElementById(id); return t ? t.content.cloneNode(true) : null; };
document.addEventListener('click', (e) => {
  const d = e.target.closest('[data-dock]');
  if (d && d.dataset.dock === 'contents') { const n = fromTemplate('tpl-contents'); if (n) Sheet.open({ title: 'Contents', node: n }); }
  if (d && d.dataset.dock === 'more') { const n = fromTemplate('tpl-more'); if (n) Sheet.open({ title: 'More', node: n }); }
  if (e.target.closest('[data-focus-on]')) { Sheet.close(true); document.dispatchEvent(new Event('jla:focus')); }
  // a link inside a sheet to a place on this page: close the sheet first, then go there
  const a = e.target.closest('.sheet a[href^="#"]:not([data-sheet])');
  if (a) {
    e.preventDefault(); const target = document.getElementById(a.getAttribute('href').slice(1)); Sheet.close(true);
    if (target) setTimeout(() => { if (target.tagName === 'DETAILS') target.open = true; scrollTo({ top: target.getBoundingClientRect().top + scrollY - 80, behavior: reduceMotion ? 'auto' : 'smooth' }); }, 40);
  }
});

/* ---------- citation formats and BibTeX / RIS export ---------- */
const citebox = $('.citebox');
if (citebox) {
  const d = citebox.dataset;
  const authors = JSON.parse(d.authors || '[]');
  const pages = d.first ? (d.last && d.last !== d.first ? `${d.first}–${d.last}` : d.first) : '';
  const link = d.doi ? `https://doi.org/${d.doi}` : d.url;

  // "Atty. Mary Christine S.C. Florete" -> { family: "Florete", given: "Mary Christine S.C." }
  const parse = (raw) => {
    let n = raw.replace(/^(Atty|Judge|Prosec|Dr|Justice|Hon)\.?\s+/i, '').replace(/,\s*(JD|RN|MAN|LLM|PhD)\b.*$/i, '').trim();
    if (!/\.\s|\s[A-Z]\.$/.test(n + ' ') && /editor|desk|board/i.test(n)) return { org: raw };
    let suffix = ''; const s = n.match(/,?\s+(Jr\.|Sr\.|III|II|IV)$/); if (s) { suffix = s[1]; n = n.slice(0, s.index); }
    const t = n.split(/\s+/);
    let i = t.length - 1; for (let k = t.length - 2; k >= 1; k--) if (/\.$/.test(t[k])) { i = k + 1; break; }
    if (i === t.length - 1 && /^(de|del|dela|la|van|von|san)$/i.test(t[i - 1] || '') && i - 1 > 0) i--;
    return { family: t.slice(i).join(' '), given: t.slice(0, i).join(' '), suffix };
  };
  const people = authors.map(parse);
  const initials = (g) => g.split(/\s+/).map((w) => w.split(/[.-]/).filter(Boolean).map((p) => p[0] + '.').join(' ')).join(' ');
  const apaName = (p) => p.org || `${p.family}, ${initials(p.given)}${p.suffix ? ', ' + p.suffix : ''}`;
  const fullInv = (p) => p.org || `${p.family}, ${p.given}${p.suffix ? ', ' + p.suffix : ''}`;
  const full = (p) => p.org || `${p.given} ${p.family}${p.suffix ? ' ' + p.suffix : ''}`;
  const joinList = (xs, amp) => xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + (xs.length > 2 ? ',' : '') + ` ${amp} ` + xs[xs.length - 1];

  const cite = $('#cite-text'); cite.dataset.house = cite.textContent.trim();
  const fmt = {
    house: () => cite.dataset.house,
    bluebook: () => `${joinList(people.map(full), '&')}, ${d.title}, ${d.volume} J.L. Advoc.${d.first ? ' ' + d.first : ''} (${d.year}).`,
    apa: () => `${joinList(people.map(apaName), '&')} (${d.year}). ${d.title}. ${d.journal}, ${d.volume}${pages ? ', ' + pages : ''}. ${link}`,
    chicago: () => `${joinList([fullInv(people[0]), ...people.slice(1).map(full)], 'and')}. “${d.title}.” ${d.journal} ${d.volume} (${d.year})${pages ? ': ' + pages : ''}. ${link}.`,
  };
  const group = $('.cite-formats', citebox);
  group.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    $$('button', group).forEach((x) => x.setAttribute('aria-pressed', x === b));
    cite.textContent = fmt[b.dataset.fmt]();
  });

  const bibName = (p) => p.org ? `{${p.org}}` : `${p.family}, ${p.suffix ? p.suffix + ', ' : ''}${p.given}`;
  const exporters = {
    bib: () => ['@article{' + d.key + ',',
      `  author  = {${people.map(bibName).join(' and ')}},`, `  title   = {{${d.title}}},`, `  journal = {${d.journal}},`,
      `  volume  = {${d.volume}},`, `  year    = {${d.year}},`, pages && `  pages   = {${pages.replace('–', '--')}},`,
      d.doi && `  doi     = {${d.doi}},`, d.issn && `  issn    = {${d.issn}},`, `  url     = {${d.url}}`, '}', ''].filter(Boolean).join('\n'),
    ris: () => ['TY  - JOUR', ...people.map((p) => `AU  - ${p.org || fullInv(p)}`), `TI  - ${d.title}`, `JO  - ${d.journal}`, `JA  - ${d.abbrev}`,
      `VL  - ${d.volume}`, `PY  - ${d.year}`, d.first && `SP  - ${d.first}`, d.last && `EP  - ${d.last}`, d.doi && `DO  - ${d.doi}`,
      d.issn && `SN  - ${d.issn}`, `UR  - ${d.url}`, 'ER  - ', ''].filter(Boolean).join('\r\n'),
  };
  citebox.addEventListener('click', (e) => {
    const b = e.target.closest('[data-export]'); if (!b) return;
    const kind = b.dataset.export;
    const blob = new Blob([exporters[kind]()], { type: kind === 'bib' ? 'application/x-bibtex' : 'application/x-research-info-systems' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${d.key}.${kind}`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  group.hidden = false; $$('[data-export]', citebox).forEach((b) => (b.hidden = false));
}

/* ---------- sharing: native share sheet, image sharing to Instagram/Facebook ---------- */
const sharePanel = $('.share-panel');
if (sharePanel) {
  const { url, title } = sharePanel.dataset;
  const touch = matchMedia('(hover: none)').matches;
  $$('[data-touch-only]', sharePanel).forEach((x) => { x.hidden = !touch; });
  const native = $('[data-native-share]', sharePanel);
  if (navigator.share) {
    native.hidden = false;
    native.addEventListener('click', () => navigator.share({ title, url }).catch(() => {}));
  }
  // share the image itself (phones: goes straight to Instagram, Facebook, Messenger…)
  const canShareFiles = !!(navigator.canShare && navigator.share);
  $$('[data-share-img]', sharePanel).forEach((b) => {
    if (!canShareFiles) return;
    b.hidden = false;
    b.addEventListener('click', async () => {
      try {
        const res = await fetch(b.dataset.shareImg); const blob = await res.blob();
        const file = new File([blob], b.dataset.shareImg.split('/').pop(), { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          const caption = $('#share-caption'); if (caption && navigator.clipboard) navigator.clipboard.writeText(caption.innerText.trim()).catch(() => {});
          await navigator.share({ files: [file], title, text: title });
          say('Caption copied: paste it into your post');
        } else { location.href = b.dataset.shareImg; }
      } catch (e) { if (e && e.name !== 'AbortError') say('Could not share the image, so use Download'); }
    });
  });
}

/* ---------- footnotes: margin notes on wide screens, a sheet on smaller ones ---------- */
const fnPanel = $('#footnotes');
const fulltext = $('#fulltext');
if (fnPanel && fulltext) {
  const refs = $$('.footnote-ref a', fulltext);
  const noteOf = (a) => document.getElementById(a.getAttribute('href').slice(1));
  const noteHtml = (note) => { const c = note.cloneNode(true); $$('.footnote-backref', c).forEach((x) => x.remove()); return c.innerHTML; };
  const numOf = (a) => a.textContent.replace(/\D/g, '');
  const wide = matchMedia('(min-width: 1300px)');

  // phones/tablets: open the note in the sheet, with previous/next
  const showNote = (i) => {
    const a = refs[i]; const note = noteOf(a); if (!note) return;
    refs.forEach((r) => r.classList.toggle('is-active', r === a));
    const html = `<p class="note-num">Note ${numOf(a)} of ${refs.length}</p><div class="note-body">${noteHtml(note)}</div>
      <div class="note-nav"><button class="btn sm alt" type="button" data-note="${i - 1}"${i === 0 ? ' disabled' : ''}>← Previous</button>
      <a class="btn sm alt" href="#footnotes" data-all-notes>All notes</a>
      <button class="btn sm alt" type="button" data-note="${i + 1}"${i === refs.length - 1 ? ' disabled' : ''}>Next →</button></div>`;
    if (Sheet.isOpen()) Sheet.setBody('Footnote', html);
    else Sheet.open({ title: 'Footnote', html, closeHook: () => refs.forEach((r) => r.classList.remove('is-active')) });
  };
  refs.forEach((a, i) => a.addEventListener('click', (e) => {
    if (wide.matches) { e.preventDefault(); return; }
    e.preventDefault(); showNote(i);
  }));
  document.addEventListener('click', (e) => {
    const n = e.target.closest('[data-note]'); if (n && !n.disabled) { showNote(+n.dataset.note); return; }
    if (e.target.closest('[data-all-notes]')) { Sheet.close(true); fnPanel.open = true; }
  });

  // wide screens: one margin note, shown beside the marker you hover, focus, or click (always aligned, never drifting)
  const side = document.createElement('aside'); side.className = 'sidenotes'; side.setAttribute('aria-live', 'polite');
  const card = document.createElement('div'); card.className = 'sidenote'; card.hidden = true; side.append(card);
  fulltext.append(side); fulltext.classList.add('has-sidenotes');
  let pinned = -1, hideT;
  const place = (i) => {
    const a = refs[i], note = noteOf(a); if (!note || !wide.matches) return;
    clearTimeout(hideT);
    card.innerHTML = `<b>${numOf(a)}</b>${noteHtml(note)}`; card.hidden = false; card.classList.add('is-active');
    refs.forEach((r, k) => r.classList.toggle('is-active', k === i));
    const top = a.getBoundingClientRect().top - fulltext.getBoundingClientRect().top - 6;
    card.style.top = Math.max(0, top) + 'px';
  };
  const unplace = () => { if (pinned >= 0) return; hideT = setTimeout(() => { card.hidden = true; refs.forEach((r) => r.classList.remove('is-active')); }, 250); };
  refs.forEach((a, i) => {
    a.addEventListener('mouseenter', () => place(i)); a.addEventListener('focus', () => place(i));
    a.addEventListener('mouseleave', unplace); a.addEventListener('blur', unplace);
  });
  card.addEventListener('mouseenter', () => clearTimeout(hideT)); card.addEventListener('mouseleave', unplace);
  // click pins the note on wide screens (overrides the sheet handler above)
  refs.forEach((a, i) => a.addEventListener('click', () => { if (!wide.matches) return; pinned = pinned === i ? -1 : i; if (pinned >= 0) place(i); else unplace(); }));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && pinned >= 0) { pinned = -1; unplace(); } });
  wide.addEventListener('change', () => { if (!wide.matches) { card.hidden = true; pinned = -1; } });
  // the end-of-article list: collapsed on phones, opened when someone jumps to it
  if (!wide.matches && !/^#fn/.test(location.hash)) fnPanel.open = false;
  const openPanel = () => { fnPanel.open = true; };
  addEventListener('hashchange', () => { if (/^#fn\d+$|^#footnotes$/.test(location.hash)) openPanel(); });
  document.addEventListener('click', (e) => { if (e.target.closest('[data-open-footnotes]')) openPanel(); });
}

/* ---------- volume launch kit: share every slide at once (phones) ---------- */
const shareSlides = $('[data-share-slides]');
if (shareSlides && navigator.canShare && navigator.share) {
  shareSlides.hidden = false;
  shareSlides.addEventListener('click', async () => {
    try {
      shareSlides.disabled = true; say('Preparing slides…');
      const imgs = $$('.slide img');
      const files = await Promise.all(imgs.map(async (img, i) => new File([await (await fetch(img.src)).blob()], `slide-${i + 1}.png`, { type: 'image/png' })));
      if (!navigator.canShare({ files })) { say('This device cannot share several images at once, so download them one by one'); return; }
      const cap = $('#launch-caption'); if (cap && navigator.clipboard) navigator.clipboard.writeText(cap.innerText.trim()).catch(() => {});
      await navigator.share({ files, title: document.title });
      say('Caption copied: paste it into your post');
    } catch (e) { if (e && e.name !== 'AbortError') say('Could not share the slides, so download them instead'); }
    finally { shareSlides.disabled = false; }
  });
}

/* ---------- quote cards: select a passage, share it as an image ---------- */
const quoteZone = $$('#fulltext, .abstract');
if (quoteZone.length && citebox) {
  const meta = { title: citebox.dataset.title, authors: JSON.parse(citebox.dataset.authors || '[]'), volume: citebox.dataset.volume, year: citebox.dataset.year, url: citebox.dataset.url };
  // a small toolbar over the selection: Highlight and Note (saved by reading-tools.js) and Share quote
  const chip = document.createElement('div');
  chip.className = 'quote-chip'; chip.hidden = true; chip.setAttribute('role', 'toolbar'); chip.setAttribute('aria-label', 'Selected text');
  chip.innerHTML = '<button type="button" data-q="highlight">Highlight</button><button type="button" data-q="note">Note</button><button type="button" data-q="comment">Comment</button>'
    + '<button type="button" data-q="share">Share quote</button>';
  document.body.append(chip);
  const touch = matchMedia('(hover: none)').matches;
  let picked = '', pickedPid = '';
  const pidOf = () => {
    const sel = getSelection(); if (!sel.rangeCount) return '';
    const r = sel.getRangeAt(0), n = r.startContainer, el = (n.nodeType === 1 ? n : n.parentElement).closest('[data-pid]');
    return el && el.contains(r.endContainer) ? el.dataset.pid : '';
  };
  chip.addEventListener('mousedown', (e) => e.preventDefault()); // keep the selection when a button is pressed
  chip.addEventListener('click', (e) => {
    const b = e.target.closest('[data-q]'); if (!b || b.dataset.q === 'share') return;
    chip.hidden = true;
    if (b.dataset.q === 'comment') document.dispatchEvent(new CustomEvent('jla:comment', { detail: { pid: pickedPid } }));
    else document.dispatchEvent(new CustomEvent('jla:highlight', { detail: { text: picked, pid: pickedPid, note: b.dataset.q === 'note' } }));
    getSelection().removeAllRanges();
  });

  const selectedText = () => {
    const sel = getSelection(); if (!sel || sel.isCollapsed || !sel.rangeCount) return '';
    const range = sel.getRangeAt(0);
    if (!quoteZone.some((z) => z.contains(range.commonAncestorContainer))) return '';
    const frag = range.cloneContents(); frag.querySelectorAll('.footnote-ref, sup, .pc-bubble, .pc-add').forEach((x) => x.remove());
    const div = document.createElement('div'); div.append(frag);
    return div.textContent.replace(/\s+/g, ' ').trim();
  };
  let st;
  document.addEventListener('selectionchange', () => {
    clearTimeout(st);
    st = setTimeout(() => {
      const t = selectedText();
      pickedPid = pidOf();
      const canShare = t.length >= 25 && t.length <= 420, canMark = !!pickedPid && t.length >= 3 && t.length <= 500;
      if (!canShare && !canMark) { chip.hidden = true; return; }
      picked = t; chip.hidden = false;
      $('[data-q=share]', chip).hidden = !canShare;
      $$('[data-q=highlight], [data-q=note], [data-q=comment]', chip).forEach((x) => { x.hidden = !canMark; });
      if (touch) { chip.classList.add('dock'); return; } // docked above the action bar; the native menu covers the selection
      const r = getSelection().getRangeAt(0).getBoundingClientRect();
      chip.classList.remove('dock');
      chip.style.left = Math.max(12, Math.min(scrollX + r.left + r.width / 2 - chip.offsetWidth / 2, scrollX + innerWidth - chip.offsetWidth - 12)) + 'px';
      chip.style.top = (scrollY + r.top - chip.offsetHeight - 10) + 'px';
    }, 180);
  });

  // draw the card: 1080×1350, ivory paper, gold double rule, seal, quote in Cormorant italic
  const loadImg = (src) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
  const wrap = (ctx, text, max) => { const words = text.split(' '), lines = []; let line = ''; for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > max && line) { lines.push(line); line = w; } else line = t; } if (line) lines.push(line); return lines; };
  const drawCard = async (quote) => {
    await Promise.all(['italic 500 60px "Cormorant Garamond"', '600 40px "Cormorant Garamond"', '600 30px "Cormorant SC"', '400 24px "Newsreader"'].map((f) => document.fonts.load(f).catch(() => {})));
    const W = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#F7F3EA'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#C9A24A'; ctx.lineWidth = 2; ctx.strokeRect(44, 44, W - 88, H - 88); ctx.lineWidth = 1; ctx.strokeRect(56, 56, W - 112, H - 112);
    try { const seal = await loadImg($('.brand img').src); ctx.drawImage(seal, W / 2 - 60, 110, 120, 120); } catch (e) {}
    ctx.textAlign = 'center';
    // measure everything first, then centre the block between the seal (y≈250) and the footer (y≈H-190)
    ctx.font = '600 34px "Cormorant Garamond"';
    const tLines = wrap(ctx, meta.title, 860); const titleLines = tLines.slice(0, 2);
    if (tLines.length > 2) titleLines[1] = titleLines[1].replace(/\s*\S*$/, '') + '…';
    const regionTop = 290, regionBottom = H - 200, after = 40 + 56 + 52 + titleLines.length * 42; // rule, author, title
    let size = 66, lines, lh;
    do { ctx.font = `italic 500 ${size}px "Cormorant Garamond"`; lines = wrap(ctx, quote, 820); lh = size * 1.28; size -= 2; }
    while (lines.length * lh + 110 + after > regionBottom - regionTop && size > 28);
    const blockH = 110 + lines.length * lh + after;
    let y = regionTop + Math.max(0, (regionBottom - regionTop - blockH) / 2);
    ctx.fillStyle = '#A98236'; ctx.font = '600 150px "Cormorant Garamond"'; ctx.fillText('“', W / 2, y + 105); y += 110 + lh * 0.75;
    ctx.font = `italic 500 ${size + 2}px "Cormorant Garamond"`; ctx.fillStyle = '#1C1424';
    lines.forEach((l, i) => ctx.fillText(l, W / 2, y + i * lh));
    y += (lines.length - 1) * lh + 40;
    ctx.fillStyle = '#C9A24A'; ctx.fillRect(W / 2 - 60, y, 120, 1); y += 56;
    ctx.fillStyle = '#4A2466'; ctx.font = '600 32px "Cormorant SC"'; if ('letterSpacing' in ctx) ctx.letterSpacing = '4px';
    ctx.fillText(meta.authors.join(' & ').toLowerCase(), W / 2, y); if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.fillStyle = '#3A3044'; ctx.font = '600 34px "Cormorant Garamond"';
    titleLines.forEach((l, i) => ctx.fillText(l, W / 2, y + 52 + i * 42));
    ctx.fillStyle = '#A98236'; ctx.font = '600 26px "Cormorant SC"'; if ('letterSpacing' in ctx) ctx.letterSpacing = '5px';
    ctx.fillText(`WVSU journal for law advocacy · vol. ${meta.volume}`, W / 2, H - 150);
    ctx.fillStyle = '#6A6070'; ctx.font = '400 22px "Newsreader"'; if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.fillText(location.host + location.pathname, W / 2, H - 112);
    return cv;
  };

  $('[data-q=share]', chip).addEventListener('click', async () => {
    // a passage cut mid-sentence gets ellipses, as in a proper quotation
    let quote = picked.replace(/^["“”']+|["“”']+$/g, '');
    if (/^[a-z]/.test(quote)) quote = '…' + quote;
    if (!/[.!?…]$/.test(quote)) quote = quote.replace(/[,;:\s]+$/, '') + '…';
    chip.hidden = true;
    const cv = await drawCard(quote);
    const url = cv.toDataURL('image/png');
    const cite = $('#cite-text') ? $('#cite-text').innerText.trim() : `${meta.title}, ${meta.url}`;
    const text = `“${quote}”\n\n${cite}\n${meta.url}`;
    Sheet.open({ title: 'Share this quote', html: `<img class="quote-preview" src="${url}" alt="Quote card">
      <div class="acts"><button class="btn sm" type="button" data-q-share hidden>Share image</button>
      <a class="btn sm alt" href="${url}" download="jla-quote.png">Download</a>
      <button class="btn sm alt" type="button" data-q-copy>Copy quote with citation</button></div>` });
    const shareBtn = $('[data-q-share]'), copyBtn = $('[data-q-copy]');
    copyBtn.addEventListener('click', () => copy(text, 'Quote and citation copied'));
    cv.toBlob((blob) => {
      const file = new File([blob], 'jla-quote.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        shareBtn.hidden = false;
        shareBtn.addEventListener('click', () => navigator.share({ files: [file], text }).catch(() => {}));
      }
    });
  });
}

/* count PDF downloads in GoatCounter, when analytics is enabled */
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href$=".pdf"], a[href*=".pdf#"]');
  if (a && window.goatcounter && window.goatcounter.count) {
    window.goatcounter.count({ path: 'download' + new URL(a.href).pathname, title: a.textContent.trim(), event: true });
  }
});

/* article filter + search (articles page only) */
const list = $('#list');
if (list) {
  const q = $('#q'), f = $('#filters'), count = $('#count'), empty = $('#empty');
  const entries = $$('.entry', list);
  let cat = new URLSearchParams(location.search).get('area') || 'All';
  const render = () => {
    const term = q.value.trim().toLowerCase();
    let n = 0;
    entries.forEach((e) => {
      const show = (cat === 'All' || e.dataset.area === cat) && (!term || e.dataset.search.includes(term));
      e.hidden = !show; if (show) n++;
    });
    $$('button', f).forEach((b) => b.setAttribute('aria-pressed', b.dataset.cat === cat));
    count.textContent = `Showing ${n} of ${entries.length} articles`;
    empty.hidden = n > 0;
  };
  f.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; cat = b.dataset.cat; render(); });
  q.addEventListener('input', render);
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); q.focus(); }
  });
  f.hidden = false; q.hidden = false;
  render();
}

/* submission form: keep the upload under Netlify's 8 MB limit */
const file = $('#manuscript');
if (file) {
  file.addEventListener('change', () => {
    const big = file.files[0] && file.files[0].size > 8 * 1024 * 1024;
    file.setCustomValidity(big ? 'The file must be 8 MB or smaller. Email larger files instead.' : '');
    if (big) file.reportValidity();
  });
}

/* shared with the ES modules (reader, reading tools, comments, account) */
window.JLA = { Sheet, say, copy, store };
document.dispatchEvent(new Event("jla:ready"));
