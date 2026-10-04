/* Share studio (article pages): Strava-style share images, drawn on the reader's own device.
   Swipe through designs, pick Story (9:16) or Post (4:5), add your own photo, or take a transparent sticker.
   Nothing is uploaded: photos stay in the browser. */
(() => {
  const dataEl = document.getElementById('share-data');
  const openers = [...document.querySelectorAll('[data-studio]')];
  if (!dataEl || !openers.length || !window.HTMLCanvasElement || !HTMLCanvasElement.prototype.toBlob) return;
  const D = JSON.parse(dataEl.textContent);

  const C = { paper: '#F7F3EA', ink: '#1C1424', ink2: '#3A3044', muted: '#6A6070', plum: '#4A2466', plum2: '#2A1640', deep: '#120B19',
    gold: '#A98236', gold2: '#C9A24A', gold3: '#E3C77E', ivory: '#F1EADD' };
  const SIZES = { story: [1080, 1920], post: [1080, 1350] };
  const FONTS = ['600 60px "Cormorant Garamond"', 'italic 500 60px "Cormorant Garamond"', '600 30px "Cormorant SC"', '400 24px "Newsreader"', '500 24px "Newsreader"'];

  const say = (m) => { const t = document.getElementById('toast'); if (!t) return; t.textContent = m; t.classList.add('on'); clearTimeout(say.t); say.t = setTimeout(() => t.classList.remove('on'), 2400); };
  const loadImg = (src) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
  let assets;
  const ready = () => assets || (assets = Promise.all([
    Promise.all(FONTS.map((f) => document.fonts.load(f).catch(() => {}))),
    loadImg('/assets/img/logo.png').catch(() => null),
  ]).then(([, seal]) => ({ seal })));

  /* ---------- drawing helpers ---------- */
  const spacing = (ctx, px) => { if ('letterSpacing' in ctx) ctx.letterSpacing = px + 'px'; };
  const wrap = (ctx, text, max) => {
    const words = String(text).split(/\s+/), lines = []; let line = '';
    for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > max && line) { lines.push(line); line = w; } else line = t; }
    if (line) lines.push(line); return lines;
  };
  // largest size (down to `min`) at which `text` fits in `lines` lines; ellipsis only as a last resort
  const fit = (ctx, text, { font, max, lines, size, min, lh = 1.14 }) => {
    let s = size, out;
    for (;;) { ctx.font = font(s); out = wrap(ctx, text, max); if (out.length <= lines || s <= min) break; s -= 2; }
    if (out.length > lines) { out = out.slice(0, lines); out[lines - 1] = out[lines - 1].replace(/\s*\S*$/, '') + '…'; }
    return { lines: out, size: s, lh: s * lh, font: font(s) };
  };
  const authorsLine = () => { const a = D.authors || []; return a.length < 3 ? a.join(' & ') : a.slice(0, -1).join(', ') + ' & ' + a[a.length - 1]; };
  const volLine = (sep = ' · ') => [`Volume ${D.roman}`, D.ay ? `AY ${D.ay}` : D.year, D.pages ? `pp. ${D.pages}` : ''].filter(Boolean).join(sep);

  // A column of rows ({h, draw(y)}) centred vertically between top and bottom
  const stack = (rows, top, bottom) => {
    const total = rows.reduce((n, r) => n + r.h, 0);
    let y = top + Math.max(0, (bottom - top - total) / 2);
    for (const r of rows) { r.draw(y); y += r.h; }
    return total;
  };
  const gap = (h) => ({ h, draw() {} });
  const textRows = (ctx, block, x, color, align = 'center') => block.lines.map((l) => ({
    h: block.lh, draw: (y) => { ctx.font = block.font; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(l, x, y + block.lh * 0.8); },
  }));
  const capsRow = (ctx, text, x, size, color, track = 4, align = 'center', max = 900) => {
    ctx.font = `600 ${size}px "Cormorant SC"`; spacing(ctx, track);
    const lines = wrap(ctx, text.toLowerCase().replace(/wvsu/g, "WVSU"), max); spacing(ctx, 0);
    return lines.map((l) => ({ h: size * 1.3, draw: (y) => { ctx.font = `600 ${size}px "Cormorant SC"`; spacing(ctx, track); ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(l, x, y + size); spacing(ctx, 0); } }));
  };
  const lineRow = (ctx, text, x, font, color, h, align = 'center') => ({ h, draw: (y) => { ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(text, x, y + h * 0.75); } });
  const ruleRow = (ctx, x, w, color, h = 2, pad = 0, align = 'center') => ({ h: h + pad * 2, draw: (y) => { ctx.fillStyle = color; ctx.fillRect(align === 'center' ? x - w / 2 : x, y + pad, w, h); } });
  const sealRow = (ctx, seal, x, d, ring) => ({ h: d, draw: (y) => drawSeal(ctx, seal, x - d / 2, y, d, ring) });
  function drawSeal(ctx, seal, x, y, d, ring) {
    if (!seal) return;
    ctx.save(); ctx.beginPath(); ctx.arc(x + d / 2, y + d / 2, d / 2, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
    ctx.drawImage(seal, x, y, d, d); ctx.restore();
    if (ring) { ctx.strokeStyle = ring; ctx.lineWidth = Math.max(2, d / 60); ctx.beginPath(); ctx.arc(x + d / 2, y + d / 2, d / 2 + d / 28, 0, Math.PI * 2); ctx.stroke(); }
  }
  const frame = (ctx, W, H, color, inset = 44) => {
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.strokeRect(inset, inset, W - inset * 2, H - inset * 2);
    ctx.lineWidth = 1; ctx.strokeRect(inset + 12, inset + 12, W - (inset + 12) * 2, H - (inset + 12) * 2);
  };
  const hostLine = (ctx, W, H, color, y) => { ctx.font = '400 24px "Newsreader"'; ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.fillText(D.host, W / 2, y); };
  // Instagram Stories cover the top and bottom of the screen with its own buttons: keep text out of those bands
  const safe = (H, story) => story ? [H * 0.14, H * 0.84] : [H * 0.1, H * 0.86];

  /* ---------- the designs ---------- */
  const TEMPLATES = [
    { id: 'classic', name: 'Classic', draw(ctx, W, H, o, a) {
      const story = H > 1500;
      ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H); frame(ctx, W, H, C.gold2);
      const t = fit(ctx, D.title, { font: (s) => `600 ${s}px "Cormorant Garamond"`, max: 860, lines: story ? 6 : 5, size: story ? 98 : 72, min: 44 });
      const [top, bottom] = safe(H, story);
      stack([
        sealRow(ctx, a.seal, W / 2, story ? 220 : 140), gap(story ? 52 : 40),
        ...capsRow(ctx, 'Published in', W / 2, story ? 36 : 30, C.gold, 6), gap(10),
        lineRow(ctx, 'WVSU Journal for Law Advocacy', W / 2, `600 ${story ? 74 : 62}px "Cormorant Garamond"`, C.ink, story ? 84 : 70),
        ruleRow(ctx, W / 2, 140, C.gold2, 2, story ? 40 : 30),
        ...textRows(ctx, t, W / 2, C.ink), gap(story ? 44 : 34),
        ...capsRow(ctx, authorsLine(), W / 2, story ? 40 : 34, C.plum, 3, 'center', 860), gap(story ? 60 : 40),
        lineRow(ctx, volLine(), W / 2, `400 ${story ? 32 : 28}px "Newsreader"`, C.muted, story ? 42 : 36),
      ], top, bottom);
      hostLine(ctx, W, H, C.gold, H - (story ? H * 0.1 : 96));
    } },

    { id: 'midnight', name: 'Midnight', draw(ctx, W, H, o, a) {
      const story = H > 1500;
      const g = ctx.createRadialGradient(W / 2, H * 0.35, 40, W / 2, H * 0.45, H * 0.85);
      g.addColorStop(0, '#3A1D57'); g.addColorStop(0.55, C.plum2); g.addColorStop(1, C.deep);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.globalAlpha = 0.07; ctx.fillStyle = C.gold2; ctx.textAlign = 'center'; ctx.font = `600 ${story ? 900 : 760}px "Cormorant Garamond"`; ctx.fillText(D.roman, W / 2, H * 0.62 + (story ? 300 : 250)); ctx.restore();
      frame(ctx, W, H, 'rgba(201,162,74,.55)');
      const t = fit(ctx, D.title, { font: (s) => `600 ${s}px "Cormorant Garamond"`, max: 860, lines: story ? 6 : 5, size: story ? 100 : 74, min: 44 });
      const [top, bottom] = safe(H, story);
      stack([
        sealRow(ctx, a.seal, W / 2, story ? 210 : 132, C.gold2), gap(story ? 64 : 44),
        ...capsRow(ctx, 'Now published', W / 2, story ? 36 : 30, C.gold2, 8), gap(story ? 30 : 22),
        ...textRows(ctx, t, W / 2, C.ivory),
        ruleRow(ctx, W / 2, 120, C.gold2, 2, story ? 40 : 30),
        ...capsRow(ctx, authorsLine(), W / 2, story ? 40 : 34, C.gold3, 3, 'center', 860), gap(story ? 60 : 40),
        lineRow(ctx, `WVSU Journal for Law Advocacy · Volume ${D.roman}`, W / 2, `italic 500 ${story ? 42 : 34}px "Cormorant Garamond"`, 'rgba(241,234,221,.82)', story ? 54 : 44),
      ], top, bottom);
      hostLine(ctx, W, H, 'rgba(227,199,126,.85)', H - (story ? H * 0.1 : 96));
    } },

    { id: 'highlights', name: 'Highlights', draw(ctx, W, H, o, a) {
      const story = H > 1500;
      ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H); frame(ctx, W, H, C.gold2);
      let stats = [[D.pageCount, D.pageCount === 1 ? 'page' : 'pages'], [D.notes, D.notes === 1 ? 'footnote' : 'footnotes'], [D.minutes, 'min read']].filter((s) => s[0] > 0);
      if (stats.length < 2) stats = [[D.roman, 'volume'], [D.year, 'year'], ...stats].slice(0, 3);
      const t = fit(ctx, D.title, { font: (s) => `600 ${s}px "Cormorant Garamond"`, max: 860, lines: story ? 5 : 4, size: story ? 88 : 62, min: 40 });
      const tile = { h: story ? 210 : 180, draw: (y) => {
        const n = stats.length, w = 860 / n, x0 = (W - 860) / 2;
        stats.forEach(([v, label], i) => {
          const cx = x0 + w * i + w / 2;
          ctx.fillStyle = C.plum; ctx.textAlign = 'center'; ctx.font = `600 ${story ? 128 : 112}px "Cormorant Garamond"`; ctx.fillText(String(v), cx, y + (story ? 120 : 104));
          ctx.font = '600 30px "Cormorant SC"'; spacing(ctx, 4); ctx.fillStyle = C.gold; ctx.fillText(label, cx, y + (story ? 170 : 150)); spacing(ctx, 0);
          if (i) { ctx.fillStyle = C.gold2; ctx.fillRect(x0 + w * i, y + 20, 1, (story ? 170 : 140)); }
        });
      } };
      const [top, bottom] = safe(H, story);
      stack([
        sealRow(ctx, a.seal, W / 2, story ? 170 : 110), gap(26),
        ...capsRow(ctx, 'WVSU Journal for Law Advocacy', W / 2, story ? 34 : 30, C.gold, 6), gap(story ? 56 : 40),
        ...textRows(ctx, t, W / 2, C.ink), gap(story ? 30 : 24),
        ...capsRow(ctx, authorsLine(), W / 2, 32, C.plum, 3, 'center', 860),
        ruleRow(ctx, W / 2, 860, 'rgba(201,162,74,.6)', 1, story ? 50 : 36),
        tile,
        ruleRow(ctx, W / 2, 860, 'rgba(201,162,74,.6)', 1, story ? 50 : 36),
        lineRow(ctx, volLine(), W / 2, '400 28px "Newsreader"', C.muted, 36),
      ], top, bottom);
      hostLine(ctx, W, H, C.gold, H - (story ? H * 0.1 : 96));
    } },

    { id: 'editorial', name: 'Editorial', draw(ctx, W, H, o, a) {
      const story = H > 1500, L = 96;
      ctx.fillStyle = C.plum; ctx.fillRect(0, 0, W, H);
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(18,11,25,0)'); g.addColorStop(1, 'rgba(18,11,25,.55)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.globalAlpha = 0.16; ctx.fillStyle = C.gold2; ctx.textAlign = 'right'; ctx.font = `600 ${story ? 980 : 800}px "Cormorant Garamond"`; ctx.fillText(D.roman, W + 40, story ? H * 0.5 : H * 0.62); ctx.restore();
      const top = safe(H, story)[0];
      drawSeal(ctx, a.seal, L, top - 10, 84, C.gold3);
      ctx.textAlign = 'left'; ctx.font = '600 30px "Cormorant SC"'; spacing(ctx, 5); ctx.fillStyle = C.ivory;
      ctx.fillText('WVSU journal for law advocacy', L + 110, top + 30); ctx.fillStyle = C.gold3; ctx.fillText(`vol. ${D.roman.toLowerCase()} · ${D.year}`, L + 110, top + 72); spacing(ctx, 0);
      ctx.fillStyle = 'rgba(227,199,126,.6)'; ctx.fillRect(L, top + 112, W - L * 2, 1);
      const t = fit(ctx, D.title, { font: (s) => `600 ${s}px "Cormorant Garamond"`, max: W - L * 2, lines: story ? 7 : 5, size: story ? 108 : 92, min: 46, lh: 1.04 });
      const rows = [
        ...capsRow(ctx, D.kind || 'Article', L, 30, C.gold3, 6, 'left'), gap(16),
        ...textRows(ctx, t, L, C.ivory, 'left'),
        ruleRow(ctx, L, 120, C.gold2, 3, 34, 'left'),
        ...capsRow(ctx, authorsLine(), L, 34, C.gold3, 3, 'left', W - L * 2),
      ];
      const total = rows.reduce((n, r) => n + r.h, 0), bottom = safe(H, story)[1];
      let y = bottom - total; rows.forEach((r) => { r.draw(y); y += r.h; });
      ctx.font = '400 24px "Newsreader"'; ctx.fillStyle = 'rgba(241,234,221,.7)'; ctx.textAlign = 'left'; ctx.fillText(D.host, L, H - (story ? H * 0.1 : 80));
    } },

    { id: 'photo', name: 'Your photo', photo: true, draw(ctx, W, H, o, a) {
      const story = H > 1500, L = 84;
      if (o.photo) {
        const p = o.photo, k = Math.max(W / p.width, H / p.height), pw = p.width * k, ph = p.height * k;
        ctx.drawImage(p, (W - pw) / 2, (H - ph) / 2, pw, ph);
      } else {
        const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#5B2E7E'); g.addColorStop(1, C.deep); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        ctx.save(); ctx.globalAlpha = 0.12; drawSeal(ctx, a.seal, W / 2 - 260, H * 0.22, 520); ctx.restore();
        if (o.preview) { ctx.fillStyle = 'rgba(241,234,221,.85)'; ctx.textAlign = 'center'; ctx.font = 'italic 500 44px "Cormorant Garamond"'; ctx.fillText('Add a photo of your own', W / 2, H * 0.4); }
      }
      const shade = ctx.createLinearGradient(0, H * 0.35, 0, H); shade.addColorStop(0, 'rgba(18,11,25,0)'); shade.addColorStop(0.55, 'rgba(18,11,25,.72)'); shade.addColorStop(1, 'rgba(18,11,25,.94)');
      ctx.fillStyle = shade; ctx.fillRect(0, 0, W, H);
      const topShade = ctx.createLinearGradient(0, 0, 0, H * 0.22); topShade.addColorStop(0, 'rgba(18,11,25,.55)'); topShade.addColorStop(1, 'rgba(18,11,25,0)'); ctx.fillStyle = topShade; ctx.fillRect(0, 0, W, H * 0.22);
      const top = safe(H, story)[0] - (story ? 60 : 20);
      drawSeal(ctx, a.seal, L, top, 76, C.gold3);
      ctx.textAlign = 'left'; ctx.font = '600 28px "Cormorant SC"'; spacing(ctx, 5); ctx.fillStyle = C.ivory; ctx.fillText('WVSU journal for law advocacy', L + 98, top + 48); spacing(ctx, 0);
      const t = fit(ctx, D.title, { font: (s) => `600 ${s}px "Cormorant Garamond"`, max: W - L * 2, lines: 4, size: story ? 84 : 72, min: 40, lh: 1.08 });
      const rows = [
        ...capsRow(ctx, 'Published', L, 28, C.gold3, 7, 'left'), gap(12),
        ...textRows(ctx, t, L, '#FFFFFF', 'left'),
        ruleRow(ctx, L, 110, C.gold2, 3, 28, 'left'),
        ...capsRow(ctx, authorsLine(), L, 32, C.gold3, 3, 'left', W - L * 2), gap(14),
        lineRow(ctx, `Volume ${D.roman} · ${D.year} · ${D.host}`, L, '400 26px "Newsreader"', 'rgba(241,234,221,.82)', 34, 'left'),
      ];
      const total = rows.reduce((n, r) => n + r.h, 0);
      let y = safe(H, story)[1] - total + (story ? 20 : 30); rows.forEach((r) => { r.draw(y); y += r.h; });
    } },

    { id: 'sticker', name: 'Sticker', sticker: true, draw(ctx, W, H, o, a) {
      // transparent background: drop it on your own Story like a Strava stats sticker
      ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 2;
      stack(stickerRows(ctx, a), 40, H - 40);
      ctx.shadowColor = 'transparent';
    } },
  ];
  function stickerRows(ctx, a) {
    const t = fit(ctx, D.title, { font: (s) => `600 ${s}px "Cormorant Garamond"`, max: 900, lines: 4, size: 70, min: 40 });
    return [
      sealRow(ctx, a.seal, 540, 150, '#FFFFFF'), gap(34),
      ...capsRow(ctx, 'Published in the WVSU Journal for Law Advocacy', 540, 28, C.gold3, 5, 'center', 960), gap(20),
      ...textRows(ctx, t, 540, '#FFFFFF'), gap(24),
      ...capsRow(ctx, authorsLine(), 540, 32, C.gold3, 3, 'center', 900), gap(12),
      lineRow(ctx, volLine(), 540, '500 28px "Newsreader"', '#FFFFFF', 36),
    ];
  }

  // Render one design. scale < 1 for the previews; the share/save copy is full size.
  async function render(tpl, fmt, scale = 1, o = {}) {
    const a = await ready();
    let [W, H] = SIZES[fmt];
    if (tpl.sticker) { // sized to its content
      const probe = document.createElement('canvas').getContext('2d');
      H = Math.ceil(stickerRows(probe, a).reduce((n, r) => n + r.h, 0) + 80);
    }
    const cv = document.createElement('canvas'); cv.width = Math.round(W * scale); cv.height = Math.round(H * scale);
    const ctx = cv.getContext('2d'); ctx.scale(scale, scale); ctx.textBaseline = 'alphabetic';
    tpl.draw(ctx, W, H, o, a);
    return cv;
  }
  const toBlob = (cv) => new Promise((ok) => cv.toBlob(ok, 'image/png'));

  /* ---------- the studio UI ---------- */
  let el, track, dots, fmt = 'story', idx = 0, photo = null, lastFocus;
  const caption = () => { const c = document.getElementById('share-caption'); return c ? c.innerText.trim() : `${D.title}\n${D.url}`; };
  const fileName = (t) => `jla-${D.slug}-${t.id}${t.sticker ? '' : '-' + fmt}.png`;

  function build() {
    el = document.createElement('div');
    el.className = 'studio'; el.hidden = true;
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Share studio');
    el.innerHTML = `
      <div class="st-top">
        <button class="st-x" type="button" data-st-close aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>
        <div class="st-fmt" role="group" aria-label="Size">
          <button type="button" data-fmt="story" aria-pressed="true">Story</button><button type="button" data-fmt="post" aria-pressed="false">Post</button>
        </div>
        <span class="st-count" aria-live="polite"></span>
      </div>
      <div class="st-stage">
        <button class="st-nav prev" type="button" aria-label="Previous design">‹</button>
        <div class="st-track" tabindex="0" aria-label="Designs"></div>
        <button class="st-nav next" type="button" aria-label="Next design">›</button>
      </div>
      <div class="st-dots" aria-hidden="true"></div>
      <div class="st-name"></div>
      <div class="st-acts">
        <label class="st-btn alt" data-st-photo hidden>Choose photo<input type="file" accept="image/*" hidden></label>
        <button class="st-btn" type="button" data-st-share>Share</button>
        <button class="st-btn alt" type="button" data-st-sticker hidden>Copy sticker</button>
        <button class="st-btn alt" type="button" data-st-save>Save image</button>
        <button class="st-btn alt" type="button" data-st-caption>Copy caption</button>
      </div>
      <p class="st-hint"></p>`;
    document.body.append(el);
    track = el.querySelector('.st-track'); dots = el.querySelector('.st-dots');
    TEMPLATES.forEach((t, i) => {
      const fig = document.createElement('figure'); fig.className = 'st-card' + (t.sticker ? ' is-sticker' : '');
      fig.dataset.i = i; fig.setAttribute('aria-label', t.name);
      track.append(fig);
      const d = document.createElement('span'); dots.append(d);
    });

    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-st-close]')) return close();
      const f = e.target.closest('[data-fmt]'); if (f && f.dataset.fmt !== fmt) { fmt = f.dataset.fmt; el.querySelectorAll('[data-fmt]').forEach((b) => b.setAttribute('aria-pressed', b === f)); paint(); }
      if (e.target.closest('.st-nav.prev')) go(idx - 1);
      if (e.target.closest('.st-nav.next')) go(idx + 1);
      const card = e.target.closest('.st-card'); if (card && +card.dataset.i !== idx) go(+card.dataset.i);
      if (e.target.closest('[data-st-share]')) share();
      if (e.target.closest('[data-st-save]')) save();
      if (e.target.closest('[data-st-sticker]')) copySticker();
      if (e.target.closest('[data-st-caption]')) copyText(caption(), 'Caption copied');
    });
    el.querySelector('input[type=file]').addEventListener('change', async (e) => {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      try { photo = await loadImg(URL.createObjectURL(f)); paint(); } catch (err) { say('That photo could not be opened'); }
    });
    let st; track.addEventListener('scroll', () => { clearTimeout(st); st = setTimeout(syncIndex, 60); }, { passive: true });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); close(); }
      if (e.key === 'ArrowRight' && e.target === track) go(idx + 1);
      if (e.key === 'ArrowLeft' && e.target === track) go(idx - 1);
      if (e.key === 'Tab') { // keep focus inside
        const f = [...el.querySelectorAll('button:not([hidden]),label:not([hidden]),[tabindex="0"]')].filter((x) => x.offsetParent);
        if (!f.length) return; const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }, true);
    const canFiles = !!(navigator.canShare && navigator.share);
    el.querySelector('.st-hint').textContent = canFiles
      ? 'Share opens Instagram, Facebook, Messenger and more. In Instagram, choose Story or Feed. The caption is copied for you.'
      : 'Save the image, then post it from your phone. Copy the caption to paste with it.';
    if (!canFiles) el.querySelector('[data-st-share]').hidden = true;
  }

  async function paint() {
    track.style.setProperty('--ar', fmt === 'story' ? '9 / 16' : '4 / 5');
    el.classList.toggle('is-post', fmt === 'post');
    const cards = [...track.children];
    await Promise.all(TEMPLATES.map(async (t, i) => {
      const cv = await render(t, fmt, 0.4, { photo, preview: true });
      cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', `${t.name} design`);
      cards[i].replaceChildren(cv);
    }));
    update();
  }
  let quietUntil = 0;
  function syncIndex() {
    if (Date.now() < quietUntil) { clearTimeout(syncIndex.t); syncIndex.t = setTimeout(syncIndex, quietUntil - Date.now() + 20); return; }
    const mid = track.scrollLeft + track.clientWidth / 2; let best = 0, dist = Infinity;
    [...track.children].forEach((c, i) => { const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid); if (d < dist) { dist = d; best = i; } });
    if (best !== idx) { idx = best; update(); }
  }
  function go(i) {
    idx = Math.max(0, Math.min(TEMPLATES.length - 1, i)); quietUntil = Date.now() + 650;
    const c = track.children[idx]; track.scrollTo({ left: c.offsetLeft + c.offsetWidth / 2 - track.clientWidth / 2, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    update();
  }
  function update() {
    const t = TEMPLATES[idx];
    [...track.children].forEach((c, i) => c.classList.toggle('is-on', i === idx));
    [...dots.children].forEach((d, i) => d.classList.toggle('on', i === idx));
    el.querySelector('.st-name').textContent = t.name + (t.sticker ? ' · transparent, for your own Story' : t.photo && !photo ? ' · choose a photo first' : '');
    el.querySelector('.st-count').textContent = `${idx + 1} / ${TEMPLATES.length}`;
    el.querySelector('[data-st-photo]').hidden = !t.photo;
    el.querySelector('[data-st-sticker]').hidden = !(t.sticker && window.ClipboardItem && navigator.clipboard && navigator.clipboard.write);
    el.querySelector('.st-fmt').classList.toggle('is-off', !!t.sticker);
    el.querySelector('.st-nav.prev').disabled = idx === 0;
    el.querySelector('.st-nav.next').disabled = idx === TEMPLATES.length - 1;
  }

  const fullBlob = () => render(TEMPLATES[idx], fmt, 1, { photo }).then(toBlob);
  async function share() {
    const t = TEMPLATES[idx];
    try {
      const blob = await fullBlob(); const file = new File([blob], fileName(t), { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        copyText(caption()); // Instagram ignores shared text, so the caption goes to the clipboard
        await navigator.share({ files: [file], title: D.title });
        say('Caption copied: paste it into your post');
      } else download(blob, fileName(t));
    } catch (e) { if (e && e.name !== 'AbortError') say('Could not share, so try Save image'); }
  }
  async function save() { const t = TEMPLATES[idx]; download(await fullBlob(), fileName(t)); }
  function download(blob, name) {
    const u = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = u; a.download = name; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 4000); say('Image saved');
  }
  async function copySticker() {
    try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': fullBlob() })]); say('Sticker copied: paste it into your Story'); }
    catch (e) { say('Could not copy, so try Save image'); }
  }
  function copyText(text, msg) {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => msg && say(msg)).catch(() => {});
  }

  async function open(startAt) {
    if (!el) build();
    lastFocus = document.activeElement;
    el.hidden = false; document.documentElement.classList.add('studio-open');
    requestAnimationFrame(() => el.classList.add('open'));
    el.querySelector('.st-x').focus({ preventScroll: true });
    await paint();
    go(startAt != null ? startAt : idx);
  }
  function close() {
    el.classList.remove('open'); document.documentElement.classList.remove('studio-open');
    setTimeout(() => { el.hidden = true; }, 220);
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  openers.forEach((b) => {
    b.hidden = false;
    b.addEventListener('click', (e) => {
      e.preventDefault();
      const want = b.dataset.studio; const i = TEMPLATES.findIndex((t) => t.id === want);
      if (b.dataset.fmt) { fmt = b.dataset.fmt; if (el) el.querySelectorAll('[data-fmt]').forEach((x) => x.setAttribute('aria-pressed', x.dataset.fmt === fmt)); }
      open(i >= 0 ? i : null);
    });
  });
})();
