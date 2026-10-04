/* Reader accounts, shared logic (no Firebase here): local progress, the article index,
   badges, weekly streaks and "read next". Used by reader.js, account.js and readers.js. */

const KEY = 'jla:progress', WEEKS = 'jla:weeks', ME = 'jla:me';
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

/* ---------- progress (kept in the browser; mirrored to the account when signed in) ---------- */
// { [slug]: { read: [paragraph ids], pct, done, doneAt, self, words, updated } }
export const local = {
  all: () => read(KEY, {}),
  get: (slug) => read(KEY, {})[slug] || null,
  put(slug, p) { const all = read(KEY, {}); all[slug] = { ...p, updated: Date.now() }; write(KEY, all); },
  replaceAll: (all) => write(KEY, all),
  weeks: () => read(WEEKS, {}),
  setWeeks: (w) => write(WEEKS, w),
  me: () => read(ME, null),
  setMe: (m) => (m ? write(ME, m) : localStorage.removeItem(ME)),
};

// merge two progress records for the same article (union of paragraphs read; finished stays finished)
export function mergeOne(a, b) {
  if (!a) return b; if (!b) return a;
  const readSet = [...new Set([...(a.read || []), ...(b.read || [])])];
  return {
    read: readSet, pct: Math.max(a.pct || 0, b.pct || 0), done: !!(a.done || b.done),
    doneAt: Math.min(a.doneAt || Infinity, b.doneAt || Infinity) === Infinity ? null : Math.min(a.doneAt || Infinity, b.doneAt || Infinity),
    self: !!((a.done && a.self) && (!b.done || b.self)), words: Math.max(a.words || 0, b.words || 0),
    updated: Math.max(a.updated || 0, b.updated || 0),
  };
}
export function mergeAll(x = {}, y = {}) {
  const out = { ...x }; for (const [k, v] of Object.entries(y)) out[k] = mergeOne(out[k], v); return out;
}
export const mergeWeeks = (a = {}, b = {}) => { const o = { ...a }; for (const [k, v] of Object.entries(b)) o[k] = Math.max(o[k] || 0, v); return o; };

/* ---------- ISO weeks and streaks ---------- */
export function isoWeek(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear(), w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7);
  return `${y}-W${String(w).padStart(2, '0')}`;
}
const prevWeek = (wk) => { const [y, w] = wk.split('-W').map(Number); const d = new Date(Date.UTC(y, 0, 4 + (w - 1) * 7 - 7)); return isoWeek(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); };
// a week counts when 10+ minutes were read (seconds stored per week) or an article was finished that week
export function activeWeeks(weeks = {}, progress = {}) {
  const set = new Set(Object.entries(weeks).filter(([, s]) => s >= 600).map(([w]) => w));
  for (const p of Object.values(progress)) if (p.done && !p.self && p.doneAt) set.add(isoWeek(new Date(p.doneAt)));
  return set;
}
export function streak(weeks, progress) {
  const set = activeWeeks(weeks, progress); let wk = isoWeek(), n = 0;
  if (!set.has(wk)) wk = prevWeek(wk); // this week isn't over yet: the streak is alive if last week counted
  while (set.has(wk)) { n++; wk = prevWeek(wk); }
  return { current: n, thisWeek: set.has(isoWeek()), best: bestRun(set) };
}
function bestRun(set) {
  let best = 0; for (const w of set) { if (set.has(nextWeek(w))) continue; let n = 0, k = w; while (set.has(k)) { n++; k = prevWeek(k); } best = Math.max(best, n); } return best;
}
const nextWeek = (wk) => { const [y, w] = wk.split('-W').map(Number); const d = new Date(Date.UTC(y, 0, 4 + (w - 1) * 7 + 7)); return isoWeek(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); };
export function addSeconds(sec) { const w = local.weeks(), k = isoWeek(); w[k] = (w[k] || 0) + sec; local.setWeeks(w); }

/* ---------- the article index (built at deploy time) ---------- */
let indexP;
export const loadIndex = () => indexP || (indexP = fetch('/api/articles.json', { cache: 'no-cache' }).then((r) => r.json()));

/* ---------- stats ---------- */
export function stats(index, progress, weeks) {
  const list = index.articles, bySlug = Object.fromEntries(list.map((a) => [a.slug, a]));
  const entries = Object.entries(progress).filter(([s]) => bySlug[s]);
  const finished = entries.filter(([, p]) => p.done), verified = finished.filter(([, p]) => !p.self);
  const inProgress = entries.filter(([, p]) => !p.done && (p.pct || 0) > 0);
  const words = entries.reduce((n, [s, p]) => n + Math.round((p.done && !p.self ? 1 : (p.pct || 0) / 100) * (bySlug[s].words || 0)), 0);
  return {
    total: list.length, finished: finished.length, verified: verified.length, inProgress: inProgress.length,
    unread: list.length - finished.length, words, streak: streak(weeks, progress),
  };
}

/* ---------- badges ---------- */
const AREA_BADGE = {
  'Constitutional law': 'Constitutionalist', 'Privacy and data protection': 'Privacy Advocate',
  'Technology and the law': 'Technologist of the Law', 'Election law': 'Election Watcher', 'Criminal law': 'Criminal Justice Scholar',
  'Environmental law': 'Environmental Steward', 'Civil law': 'Civilist', 'Taxation': 'Tax Counsel', 'Legal ethics and the profession': 'Officer of the Court',
};
const roman = (n) => [['M', 1000], ['CM', 900], ['D', 500], ['CD', 400], ['C', 100], ['XC', 90], ['L', 50], ['XL', 40], ['X', 10], ['IX', 9], ['V', 5], ['IV', 4], ['I', 1]]
  .reduce((s, [r, v]) => { while (n >= v) { s += r; n -= v; } return s; }, '');

// every badge, with whether it is earned and how far along the reader is. Only verified reading counts.
export function badges(index, progress, weeks) {
  const list = index.articles, done = (a) => progress[a.slug] && progress[a.slug].done && !progress[a.slug].self;
  const n = list.filter(done).length, textList = list.filter((a) => a.text);
  const st = streak(weeks, progress);
  const out = [
    { id: 'first-reading', name: 'First Reading', glyph: 'I', how: 'Finish your first article', have: n, need: 1 },
    { id: 'second-reading', name: 'Second Reading', glyph: 'II', how: 'Finish 5 articles', have: n, need: 5 },
    { id: 'third-reading', name: 'Third Reading', glyph: 'III', how: 'Finish 10 articles', have: n, need: 10 },
    { id: 'enrolled-bill', name: 'Enrolled Bill', glyph: '§', how: 'Finish 25 articles', have: n, need: 25 },
    { id: 'codified', name: 'Codified', glyph: '❦', how: 'Finish every article with full text online', have: textList.filter(done).length, need: textList.length },
    { id: 'weekly-reader', name: 'Weekly Reader', glyph: '✦', how: 'Read 4 weeks in a row', have: Math.max(st.current, st.best), need: 4 },
    { id: 'term-regular', name: 'Term Regular', glyph: '✧', how: 'Read 12 weeks in a row', have: Math.max(st.current, st.best), need: 12 },
    { id: 'early-bird', name: 'Early Bird', glyph: '☉', how: 'Finish a piece within 14 days of its volume launch',
      have: list.some((a) => done(a) && a.launched && progress[a.slug].doneAt - Date.parse(a.launched) < 14 * 864e5 && progress[a.slug].doneAt >= Date.parse(a.launched)) ? 1 : 0, need: 1 },
  ];
  // a volume badge for every volume whose pieces are all online in full
  const vols = [...new Set(list.map((a) => a.volume))].sort((a, b) => b - a);
  for (const v of vols) {
    const items = list.filter((a) => a.volume === v);
    if (!items.every((a) => a.text)) continue;
    out.push({ id: `volume-${v}`, name: `Volume ${roman(v)}, Complete`, glyph: roman(v), how: `Finish all ${items.length} pieces of Volume ${v}`, have: items.filter(done).length, need: items.length });
  }
  for (const [area, name] of Object.entries(AREA_BADGE)) {
    const items = textList.filter((a) => a.area === area); if (items.length < 3) continue;
    out.push({ id: `area-${area.toLowerCase().replace(/[^a-z]+/g, '-')}`, name, glyph: name[0], how: `Finish 3 pieces on ${area.toLowerCase()}`, have: items.filter(done).length, need: 3 });
  }
  return out.map((b) => ({ ...b, earned: b.need > 0 && b.have >= b.need, have: Math.min(b.have, b.need) }));
}

/* ---------- read next ---------- */
export function suggest(index, progress, { exclude = [], count = 3 } = {}) {
  const list = index.articles, newest = Math.max(...list.map((a) => a.volume));
  const finished = list.filter((a) => progress[a.slug] && progress[a.slug].done);
  const areas = {}, authors = new Set(), kw = new Set();
  for (const a of finished) { areas[a.area] = (areas[a.area] || 0) + 1; a.authors.forEach((x) => authors.add(x)); a.keywords.forEach((k) => kw.add(k.toLowerCase())); }
  return list
    .filter((a) => !(progress[a.slug] && progress[a.slug].done) && !exclude.includes(a.slug))
    .map((a) => {
      let score = (areas[a.area] ? 3 : 0) + (a.authors.some((x) => authors.has(x)) ? 2 : 0)
        + a.keywords.filter((k) => kw.has(k.toLowerCase())).length + (a.volume === newest ? 1 : 0) + (a.text ? 1 : 0)
        + ((progress[a.slug] && progress[a.slug].pct) ? 2 : 0); // something already started is a good next read
      return { a, score: score + Math.random() * 0.5 }; // a little variety among equals
    })
    .sort((x, y) => y.score - x.score).slice(0, count).map((x) => x.a);
}

/* ---------- small DOM helpers shared by the pages ---------- */
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const badgeHtml = (b) => `<li class="badge-item${b.earned ? ' earned' : ''}" title="${esc(b.how)}">
  <span class="medal" aria-hidden="true"><span>${esc(b.glyph)}</span></span>
  <b>${esc(b.name)}</b><small>${b.earned ? 'Earned' : `${esc(b.how)} · ${b.have}/${b.need}`}</small></li>`;
export const cardHtml = (a, p) => `<a class="next-card" href="${a.url}">
  <span class="nc-meta">${esc(a.area)} · Vol. ${a.volume}</span>
  <b>${esc(a.title)}</b><span class="nc-by">${esc(a.authors.join(' & '))}</span>
  ${p && p.pct && !p.done ? `<span class="pbar"><i style="width:${Math.round(p.pct)}%"></i></span><span class="nc-pct">${Math.round(p.pct)}% read</span>` : ''}
  ${!a.text ? '<span class="nc-pdf">PDF</span>' : ''}</a>`;
