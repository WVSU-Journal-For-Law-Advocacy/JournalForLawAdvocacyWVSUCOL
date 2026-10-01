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
