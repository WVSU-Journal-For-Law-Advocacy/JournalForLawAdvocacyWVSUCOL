/* Article metrics, the scholarly way: views, full reads and PDF downloads, counted on this site and shown quietly.
   Counting: each browser counts an article's full read and PDF download once, and a view at most once a day
   (netlify/functions/count.mjs adds it to stats/{slug}). Nothing about the reader is sent or kept.
   Showing: read straight from Firestore over HTTPS (no Firebase SDK); figures appear only past a small threshold. */
const cfgEl = document.getElementById('fb-config');
const cfg = cfgEl ? JSON.parse(cfgEl.textContent || 'null') : null;
const MIN_VIEWS = 10; // below this an article shows no metrics at all
const fmt = (n) => Number(n || 0).toLocaleString('en-PH');
const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };

export function track(slug, ev) {
  if (!slug || !/^(view|read|pdf)$/.test(ev)) return;
  const key = `jla:m:${ev}:${slug}`, last = +(store.get(key) || 0);
  if (ev === 'view' ? Date.now() - last < 20 * 36e5 : last) return; // a view a day; a read or download once
  store.set(key, String(Date.now()));
  const body = JSON.stringify({ slug, ev });
  if (navigator.sendBeacon && navigator.sendBeacon('/.netlify/functions/count', body)) return;
  fetch('/.netlify/functions/count', { method: 'POST', body, keepalive: true }).catch(() => {});
}

// { slug: { views, reads, downloads } } for many articles in one request
export async function stats(slugs) {
  if (!cfg || !cfg.projectId || !slugs.length) return {};
  const base = `projects/${cfg.projectId}/databases/(default)/documents`;
  const r = await fetch(`https://firestore.googleapis.com/v1/${base}:batchGet?key=${cfg.apiKey}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documents: slugs.map((s) => `${base}/stats/${s}`) }),
  });
  if (!r.ok) return {};
  const out = {};
  for (const row of await r.json()) {
    if (!row.found) continue;
    const f = row.found.fields || {}, n = (k) => Number((f[k] && (f[k].integerValue || f[k].doubleValue)) || 0);
    out[row.found.name.split('/').pop()] = { views: n('views'), reads: n('reads'), downloads: n('downloads') };
  }
  return out;
}

/* ---------- an article page ---------- */
const box = document.querySelector('[data-metrics]');
if (box) {
  const slug = box.dataset.metrics;
  track(slug, 'view');
  document.addEventListener('jla:progress', (e) => { if (e.detail && e.detail.done) track(slug, 'read'); });
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href$=".pdf"]');
    if (a && /\/uploads\/articles\//.test(a.getAttribute('href'))) track(slug, 'pdf');
  });
  stats([slug]).then((all) => {
    const s = all[slug]; if (!s || s.views < MIN_VIEWS) return;
    for (const k of ['views', 'reads', 'downloads']) {
      box.querySelector(`[data-m="${k}"]`).textContent = fmt(s[k]);
      box.querySelector(`[data-m-wrap="${k}"]`).hidden = !s[k];
    }
    box.hidden = false;
  }).catch(() => {});
}

/* ---------- an author page: readership across their pieces ---------- */
const sum = document.querySelector('[data-metrics-sum]');
if (sum) {
  const slugs = sum.dataset.metricsSum.split(',').filter(Boolean);
  stats(slugs).then((all) => {
    const t = Object.values(all).reduce((a, s) => ({ views: a.views + s.views, reads: a.reads + s.reads, downloads: a.downloads + s.downloads }), { views: 0, reads: 0, downloads: 0 });
    if (t.views < MIN_VIEWS) return;
    sum.querySelector('[data-m="views"]').textContent = fmt(t.views);
    sum.querySelector('[data-m="reads"]').textContent = fmt(t.reads);
    sum.querySelector('[data-m="downloads"]').textContent = fmt(t.downloads);
    sum.hidden = false;
  }).catch(() => {});
}

/* ---------- a volume page: the most read pieces ---------- */
const top = document.querySelector('[data-metrics-top]');
if (top) {
  let pieces = []; try { pieces = JSON.parse(top.dataset.metricsTop); } catch (e) {}
  stats(pieces.map((p) => p.slug)).then((all) => {
    const ranked = pieces.map((p) => ({ ...p, ...(all[p.slug] || { views: 0, reads: 0, downloads: 0 }) }))
      .filter((p) => p.reads >= 3).sort((a, b) => b.reads - a.reads || b.views - a.views).slice(0, 3);
    if (!ranked.length) return;
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    top.querySelector('ol').innerHTML = ranked.map((p) => `<li><a href="${esc(p.url)}">${esc(p.title)}</a><span>${esc(p.author)} · ${fmt(p.reads)} full reads</span></li>`).join('');
    top.hidden = false;
  }).catch(() => {});
}
