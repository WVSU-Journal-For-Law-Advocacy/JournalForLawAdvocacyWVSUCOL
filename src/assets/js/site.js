const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const root = document.documentElement;

/* toast */
const toast = $('#toast');
let tt;
const say = (m) => { toast.textContent = m; toast.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => toast.classList.remove('on'), 2200); };

/* theme toggle */
const tb = $('#tb');
const label = () => { const d = root.dataset.theme === 'dark'; tb.textContent = d ? 'Light mode' : 'Dark mode'; tb.setAttribute('aria-pressed', d); };
tb.addEventListener('click', () => {
  const t = root.dataset.theme === 'dark' ? 'light' : 'dark';
  root.dataset.theme = t;
  try { localStorage.setItem('jla-theme', t); } catch (e) {}
  label();
});
label();

/* mobile menu */
const nav = $('.nav'), menu = $('#menu');
menu.addEventListener('click', () => { const o = nav.classList.toggle('open'); menu.setAttribute('aria-expanded', o); });

/* reading progress */
const bar = $('#bar');
addEventListener('scroll', () => { bar.style.transform = `scaleX(${root.scrollTop / Math.max(1, root.scrollHeight - root.clientHeight)})`; }, { passive: true });

/* copy citation / link */
const copy = (text, done, fallbackEl) =>
  (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => say(done), () => {
    if (!fallbackEl) return say(text);
    const r = document.createRange(); r.selectNodeContents(fallbackEl);
    getSelection().removeAllRanges(); getSelection().addRange(r); say('Press Ctrl+C to copy');
  });
document.addEventListener('click', (e) => {
  const c = e.target.closest('[data-copy]');
  if (c) { const el = $(c.dataset.copy); return copy(el.textContent.trim(), 'Citation copied', el); }
  const l = e.target.closest('[data-copy-link]');
  if (l) copy(location.href.split('#')[0], 'Link copied');
});

/* citation formats and BibTeX / RIS export (article pages only) */
const citebox = $('#citebox');
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

  const fmt = {
    house: () => $('#cite').dataset.house,
    bluebook: () => `${joinList(people.map(full), '&')},${d.title}, ${d.volume} J.L. Advoc.${d.first ? ' ' + d.first : ''} (${d.year}).`,
    apa: () => `${joinList(people.map(apaName), '&')} (${d.year}). ${d.title}. ${d.journal}, ${d.volume}${pages ? ', ' + pages : ''}. ${link}`,
    chicago: () => `${joinList([fullInv(people[0]), ...people.slice(1).map(full)], 'and')}. “${d.title}.” ${d.journal} ${d.volume} (${d.year})${pages ? ': ' + pages : ''}. ${link}.`,
  };
  const cite = $('#cite'); cite.dataset.house = cite.textContent.trim();
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

/* footnotes: preview on hover/focus (tap on touch), and open the panel when jumping to a note */
const fnPanel = $('#footnotes');
if (fnPanel) {
  const openPanel = () => { fnPanel.open = true; };
  const fromHash = () => { if (/^#fn\d+$/.test(location.hash) || location.hash === '#footnotes') openPanel(); };
  addEventListener('hashchange', fromHash); fromHash();
  document.addEventListener('click', (e) => { if (e.target.closest('[data-open-footnotes]')) openPanel(); });

  let pop = null, owner = null, hideT;
  const hide = () => { if (pop) { pop.remove(); pop = null; owner = null; } };
  const show = (a) => {
    const note = document.getElementById(a.getAttribute('href').slice(1));
    if (!note || owner === a) return;
    hide(); owner = a;
    const copyEl = note.cloneNode(true); $$('.footnote-backref', copyEl).forEach((x) => x.remove());
    pop = document.createElement('div'); pop.className = 'fn-pop'; pop.setAttribute('role', 'tooltip');
    pop.innerHTML = `<b>${a.textContent.replace(/\D/g, '')}</b>${copyEl.innerHTML}`;
    document.body.appendChild(pop);
    const r = a.getBoundingClientRect(), w = pop.offsetWidth;
    const left = Math.max(12, Math.min(scrollX + r.left - w / 2, scrollX + innerWidth - w - 12));
    const below = r.bottom + pop.offsetHeight + 12 > innerHeight;
    pop.style.left = left + 'px';
    pop.style.top = (below ? scrollY + r.top - pop.offsetHeight - 8 : scrollY + r.bottom + 8) + 'px';
    pop.addEventListener('mouseenter', () => clearTimeout(hideT));
    pop.addEventListener('mouseleave', () => { hideT = setTimeout(hide, 200); });
  };
  const refs = $$('.footnote-ref a');
  const touch = matchMedia('(hover: none)').matches;
  refs.forEach((a) => {
    if (touch) {
      a.addEventListener('click', (e) => { if (owner !== a) { e.preventDefault(); show(a); } });
    } else {
      a.addEventListener('mouseenter', () => { clearTimeout(hideT); show(a); });
      a.addEventListener('mouseleave', () => { hideT = setTimeout(hide, 250); });
      a.addEventListener('focus', () => show(a));
      a.addEventListener('blur', () => { hideT = setTimeout(hide, 250); });
    }
    a.addEventListener('click', openPanel);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
  document.addEventListener('click', (e) => { if (pop && !e.target.closest('.fn-pop, .footnote-ref')) hide(); });
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
