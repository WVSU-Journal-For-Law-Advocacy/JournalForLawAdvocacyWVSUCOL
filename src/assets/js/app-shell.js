/* The app layer's behaviour (loaded only in the installed app, or with ?app=1):
   the back arrow, the app bar on scroll, the More sheet, a light tap on touch, and the personal parts of Home. */
import { local, loadIndex, suggest, streak, esc, photoOf, coverTitle } from './jla-core.js';

const root = document.documentElement, body = document.body;
const J = () => window.JLA;
const tap = () => { try { navigator.vibrate && navigator.vibrate(6); } catch (e) {} };

/* ---------- back: to the previous screen inside the app, or Home ---------- */
document.addEventListener('click', (e) => {
  if (!e.target.closest('[data-app-back]')) return;
  tap();
  const fromHere = document.referrer && new URL(document.referrer).origin === location.origin;
  if (fromHere && history.length > 1) history.back(); else location.href = '/';
});

/* ---------- the app bar: a hairline once scrolled; on inner screens the title appears when the big one scrolls away ---------- */
const big = document.querySelector('.pagehead h1, .art-head h1, main h1');
const onScroll = () => {
  root.classList.toggle('scrolled', scrollY > 4);
  const off = !big || big.getBoundingClientRect().bottom < 60;
  root.classList.toggle('title-on', off);
};
addEventListener('scroll', onScroll, { passive: true }); onScroll();

/* a light tap under the finger for tabs and buttons (Android) */
document.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch' && e.target.closest('.app-tabbar a, .app-tabbar button, .btn, .icon-btn')) tap(); }, { passive: true });

/* ---------- More ---------- */
const ic = {
  about: '<path d="M12 3 3 8h18zM5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20.5h18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  board: '<circle cx="9" cy="8.5" r="3" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M3.5 19c.8-3.2 2.9-5 5.5-5s4.7 1.8 5.5 5M15.5 6.2a3 3 0 1 1 1 5.6M17.5 14.3c1.6.6 2.6 2.1 3 4.7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  authors: '<path d="M4 20V6a2 2 0 0 1 2-2h12v16H6a2 2 0 0 1-2-2M8 8h6M8 11.5h6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  news: '<path d="M4 5h13v14H6a2 2 0 0 1-2-2zM17 9h3v8a2 2 0 0 1-2 2M7.5 9h6M7.5 12.5h6M7.5 16h4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  cfp: '<path d="M4 6.5 12 12l8-5.5M4 6h16v12H4z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
  submit: '<path d="M12 16V4M7.5 8.5 12 4l4.5 4.5M5 14v6h14v-6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  theme: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
  share: '<circle cx="6" cy="12" r="2.3" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="18" cy="6" r="2.3" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="18" cy="18" r="2.3" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="m8 11 8-4M8 13l8 4" stroke="currentColor" stroke-width="1.5"/>',
  gavel: '<path d="m13 4 7 7M10 7l7 7M11.5 5.5l-4 4M18.5 12.5l-4 4M9.5 11.5 3 18l2 2 6.5-6.5M13 21h8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
};
const tile = (href, icon, label, attrs = '') => `<${href ? `a href="${href}"` : `button type="button" ${attrs}`}><svg viewBox="0 0 24 24" aria-hidden="true">${ic[icon]}</svg>${label}</${href ? 'a' : 'button'}>`;
function openMore() {
  const me = local.me(), dark = root.dataset.theme === 'dark';
  J().Sheet.open({
    title: 'More',
    html: `<div class="more-grid">
        ${tile('/about/', 'about', 'About')}
        ${tile('/board/', 'board', 'Editorial board')}
        ${tile('/authors/', 'authors', 'Authors')}
        ${tile('/news/', 'news', 'News')}
        ${tile('/call-for-papers/', 'cfp', 'Call for papers')}
        ${tile('/submit/', 'submit', 'Submit')}
        ${tile('', 'theme', dark ? 'Light mode' : 'Dark mode', 'data-more-theme')}
        ${tile('', 'share', 'Share the app', 'data-more-share')}
        ${me && me.editor ? tile('/editor/', 'gavel', 'Board tools') : tile('/archive/', 'about', 'Archive')}
      </div>
      <ul class="more-list">
        <li><a href="/about/history/">Our history</a></li>
        <li><a href="/policies/">Policies</a></li>
        <li><a href="/community/">Community guidelines</a></li>
        <li><a href="/privacy/">Privacy notice</a></li>
        <li><a href="mailto:col_journal@wvsu.edu.ph">Write to the editors</a></li>
      </ul>
      <p class="more-foot">WVSU Journal for Law Advocacy · Est. MMXXI</p>`,
  });
}
document.addEventListener('click', async (e) => {
  if (e.target.closest('[data-app-more]')) { tap(); return openMore(); }
  if (e.target.closest('[data-more-theme]')) {
    const t = document.querySelector('.tb'); if (t) t.click();
    J().Sheet.close(); return;
  }
  if (e.target.closest('[data-more-share]')) {
    const data = { title: 'WVSU Journal for Law Advocacy', text: 'Read the WVSU Journal for Law Advocacy, free, on your phone.', url: location.origin + '/app/' };
    if (navigator.share) navigator.share(data).catch(() => {}); else J().copy(data.url, 'Link copied');
  }
});

/* ---------- Home: hello, streak, continue reading, picked for you ---------- */
const home = document.querySelector('.app-home');
if (home) {
  const h = new Date().getHours(), me = local.me();
  const first = me && me.name ? me.name.split(/\s+/)[0] : '';
  home.querySelector('[data-hello]').textContent = `${h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'}${first ? `, ${first}` : ''}`;
  home.querySelector('[data-today]').textContent = new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' });

  const progress = local.all();
  const st = streak(local.weeks(), progress), sEl = home.querySelector('[data-streak]');
  if (st.current) { sEl.hidden = false; sEl.innerHTML = `<b>${st.current}</b> week${st.current > 1 ? 's' : ''} reading streak${st.thisWeek ? '' : ' · read this week to keep it'}`; }

  let tones = {}; try { tones = JSON.parse(home.dataset.tones || '{}'); } catch (e) {}
  const roman = (n) => { n = Number(n) || 0; return [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']].reduce((s, [v, r]) => { while (n >= v) { s += r; n -= v; } return s; }, ''); };
  const cover = (a) => `<span class="cover" style="--tone:${esc(tones[a.area] || '#4A2466')}">${photoOf(a)}<span class="cv-top">${esc(a.area || '')}</span>
    <span class="cv-title${coverTitle(a.title).length > 46 ? ' is-long' : ''}">${esc(coverTitle(a.title))}</span><span class="cv-author">${esc((a.authors || [])[0] || '')}${(a.authors || []).length > 1 ? ' et al.' : ''}</span><span class="cv-foot"><i></i>Vol. ${roman(a.volume)} · ${roman(a.year)}</span></span>`;

  loadIndex().then((index) => {
    const bySlug = Object.fromEntries(index.articles.map((a) => [a.slug, a]));
    const going = Object.entries(progress).filter(([s, p]) => bySlug[s] && p && !p.done && p.pct >= 2).sort((x, y) => (y[1].updated || 0) - (x[1].updated || 0));
    if (going.length) {
      const [slug, p] = going[0], a = bySlug[slug];
      home.querySelector('[data-continue]').hidden = false;
      home.querySelector('[data-continue-card]').innerHTML = `<a class="cont-card" href="${a.url}">${cover(a)}<span>
        <span class="cc-meta">${esc(a.area)} · Vol. ${roman(a.volume)}</span><b>${esc(a.title)}</b>
        <span class="pbar"><i style="width:${Math.round(p.pct)}%"></i></span><small>${Math.round(p.pct)}% read · pick up where you left off</small></span></a>`;
    }
    const picks = suggest(index, progress, { count: 8, exclude: going.slice(0, 1).map(([s]) => s) });
    if (picks.length) {
      home.querySelector('[data-foryou]').hidden = false;
      home.querySelector('[data-foryou-shelf]').innerHTML = picks.map((a) => `<a class="cover-card" href="${a.url}">${cover(a)}
        <span class="cc-title">${esc(a.title)}</span><span class="cc-by">${esc(a.authors.join(' & '))}</span></a>`).join('');
    }
  }).catch(() => {});
}


/* phones have no "/" key */
const q = document.getElementById('q'); if (q) q.placeholder = 'Search articles';

/* ---------- Home: the featured carousel (swipe, dots, a gentle auto-advance that stops once you touch it) ---------- */
const rail = document.querySelector('[data-rail]');
if (rail) {
  const track = rail.querySelector('[data-rail-track]'), slides = [...track.children], dots = rail.querySelector('[data-rail-dots]');
  dots.innerHTML = slides.map((_, i) => `<button type="button" data-go="${i}" tabindex="-1"></button>`).join('');
  const at = () => Math.round(track.scrollLeft / Math.max(1, slides[0].offsetWidth + 12));
  const paint = () => { const i = at(); [...dots.children].forEach((d, k) => d.classList.toggle('on', k === i)); };
  const go = (i) => track.scrollTo({ left: slides[(i + slides.length) % slides.length].offsetLeft - slides[0].offsetLeft, behavior: 'smooth' });
  track.addEventListener('scroll', () => { clearTimeout(paint.t); paint.t = setTimeout(paint, 60); }, { passive: true });
  dots.addEventListener('click', (e) => { const b = e.target.closest('[data-go]'); if (b) { stop(); go(+b.dataset.go); } });
  let timer = 0; const stop = () => clearInterval(timer);
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches && slides.length > 1) timer = setInterval(() => { if (!document.hidden) go(at() + 1); }, 6500);
  ['pointerdown', 'wheel', 'touchstart', 'keydown'].forEach((ev) => track.addEventListener(ev, stop, { passive: true }));
  paint();
}

/* ---------- Home: most read, ranked (shown once there are real figures) ---------- */
const rank = document.querySelector('[data-rank]');
if (rank) {
  let pieces = []; try { pieces = JSON.parse(rank.dataset.rank); } catch (e) {}
  import('./metrics.js').then(({ stats }) => stats(pieces.map((p) => p.slug))).then((all) => {
    const top = pieces.map((p) => ({ ...p, ...(all[p.slug] || { reads: 0, views: 0 }) })).filter((p) => p.reads >= 3)
      .sort((a, b) => b.reads - a.reads || b.views - a.views).slice(0, 5);
    if (top.length < 3) return;
    let tones = {}; try { tones = JSON.parse(document.getElementById('area-tones').textContent); } catch (e) {}
    rank.querySelector('[data-rank-list]').innerHTML = top.map((p, i) => `<li><a href="${esc(p.url)}">
      <span class="rk-n">${i + 1}</span>
      <span class="cover nc-cover" style="--tone:${esc(tones[p.area] || '#4A2466')}" aria-hidden="true"><span class="cv-title">${esc(coverTitle(p.title))}</span></span>
      <span class="rk-body"><b>${esc(p.title)}</b><span>${esc(p.author)}</span><small>${p.reads.toLocaleString('en-PH')} full reads</small></span></a></li>`).join('');
    rank.hidden = false;
  }).catch(() => {});
}
