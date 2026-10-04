// Builds the share images for every article at build time (see eleventy.config.js):
//   og/<slug>.png            1200×630   link previews (Facebook, Messenger, X, LinkedIn)
//   share/<slug>-post.png    1080×1350  Instagram / Facebook post (4:5)
//   share/<slug>-story.png   1080×1920  Instagram / Facebook story (9:16)
// One "certificate" design: ivory paper, gold double-rule frame, the seal, "Published in".
import fs from "node:fs";
import path from "node:path";

const C = { paper: "#F7F3EA", ink: "#1C1424", ink2: "#3A3044", muted: "#6A6070", gold: "#A98236", gold2: "#C9A24A", plum: "#4A2466" };

const font = (file) => fs.readFileSync(path.join("src/_og/fonts", file));
const el = (type, style, children) => ({ type, props: { style, children } });
const clip = (t, max) => (t.length > max ? t.slice(0, max - 1).replace(/\s+\S*$/, "") + "…" : t);

// per-format geometry; title size steps down for longer titles
const FORMATS = {
  og: { w: 1200, h: 630, pad: 34, seal: 78, eyebrow: 22, title: [56, 48, 40, 34], max: 150, author: 28, meta: 21, gap: 14 },
  post: { w: 1080, h: 1350, pad: 44, seal: 150, eyebrow: 30, title: [84, 72, 60, 50], max: 190, author: 40, meta: 28, gap: 30 },
  story: { w: 1080, h: 1920, pad: 50, seal: 250, eyebrow: 38, title: [112, 98, 82, 68], max: 210, author: 50, meta: 34, gap: 56 },
};
const titleSize = (f, t) => (t.length <= 50 ? f.title[0] : t.length <= 90 ? f.title[1] : t.length <= 140 ? f.title[2] : f.title[3]);

function card(f, { title, author, meta, kicker, seal, host }) {
  const caps = (size, color, text, extra = {}) => el("div", { display: "flex", fontFamily: "Cormorant SC", fontWeight: 600, fontSize: size, letterSpacing: size * 0.16, color, ...extra }, text);
  const fleuron = el("div", { display: "flex", alignItems: "center", gap: 18, margin: `${f.gap * 0.6}px 0` }, [
    el("div", { width: f.w * 0.12, height: 1, backgroundColor: C.gold2 }),
    el("div", { width: f.eyebrow * 0.42, height: f.eyebrow * 0.42, backgroundColor: C.gold, transform: "rotate(45deg)" }),
    el("div", { width: f.w * 0.12, height: 1, backgroundColor: C.gold2 }),
  ]);
  return el("div", { width: f.w, height: f.h, display: "flex", backgroundColor: C.paper, padding: f.pad }, [
    // gold double-rule frame
    el("div", { flex: 1, display: "flex", border: `2px solid ${C.gold2}`, padding: 8 }, [
      el("div", { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: `1px solid ${C.gold2}`, padding: `${f.gap}px ${f.pad * 1.4}px`, textAlign: "center" }, [
        { type: "img", props: { src: seal, width: f.seal, height: f.seal, style: { marginBottom: f.gap } } },
        caps(f.eyebrow * 0.85, C.gold, kicker),
        caps(f.eyebrow, C.ink, "WVSU journal for law advocacy", { marginTop: 6 }),
        fleuron,
        el("div", { display: "flex", justifyContent: "center", fontFamily: "Cormorant Garamond", fontWeight: 600, fontSize: titleSize(f, title), lineHeight: 1.08, color: C.ink, maxWidth: f.w * 0.78 }, clip(title, f.max)),
        el("div", { display: "flex", fontFamily: "Cormorant Garamond", fontStyle: "italic", fontWeight: 500, fontSize: f.author * 0.8, color: C.muted, marginTop: f.gap * 0.8 }, "by"),
        caps(f.author, C.plum, author.toLowerCase(), { marginTop: 4, maxWidth: f.w * 0.8, justifyContent: "center" }),
        el("div", { display: "flex", fontFamily: "Newsreader", fontSize: f.meta, color: C.ink2, marginTop: f.gap }, meta),
        el("div", { display: "flex", fontFamily: "Newsreader", fontSize: f.meta * 0.78, color: C.muted, marginTop: 6 }, "West Visayas State University College of Law"),
        ...(f.w === 1080 && host ? [caps(f.meta * 0.8, C.gold, host, { marginTop: f.gap * 1.2, letterSpacing: f.meta * 0.08 })] : []),
      ]),
    ]),
  ]);
}

const roman = (n) => { let x = Number(n) || 0, out = ""; for (const [v, s] of [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]]) while (x >= v) { out += s; x -= v; } return out; };
const caps = (size, color, text, extra = {}) => el("div", { display: "flex", fontFamily: "Cormorant SC", fontWeight: 600, fontSize: size, letterSpacing: size * 0.16, color, ...extra }, text);
const serif = (size, color, text, extra = {}) => el("div", { display: "flex", fontFamily: "Cormorant Garamond", fontWeight: 600, fontSize: size, color, lineHeight: 1.1, ...extra }, text);
const italic = (size, color, text, extra = {}) => el("div", { display: "flex", fontFamily: "Cormorant Garamond", fontStyle: "italic", fontWeight: 500, fontSize: size, color, ...extra }, text);
const body = (size, color, text, extra = {}) => el("div", { display: "flex", fontFamily: "Newsreader", fontSize: size, color, ...extra }, text);
const fleuronOf = (w, size, margin) => el("div", { display: "flex", alignItems: "center", gap: size * 0.8, margin }, [
  el("div", { width: w, height: 1, backgroundColor: C.gold2 }),
  el("div", { width: size * 0.42, height: size * 0.42, backgroundColor: C.gold, transform: "rotate(45deg)" }),
  el("div", { width: w, height: 1, backgroundColor: C.gold2 }),
]);
const framed = (w, h, pad, inner, justify = "center") => el("div", { width: w, height: h, display: "flex", backgroundColor: C.paper, padding: pad }, [
  el("div", { flex: 1, display: "flex", border: `${Math.max(2, w / 600)}px solid ${C.gold2}`, padding: Math.max(8, w / 140) }, [
    el("div", { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: justify, border: `1px solid ${C.gold2}`, padding: `${pad}px ${pad * 1.3}px`, textAlign: "center" }, inner),
  ]),
]);

// Certificate of publication: A4 landscape at ~200 dpi
const CERT = { w: 2339, h: 1654 };
function certificate({ name, title, volume, ay, pages, issn, verify, seal }) {
  const sigLine = (label) => el("div", { display: "flex", flexDirection: "column", alignItems: "center", width: 560 }, [
    el("div", { width: 520, height: 2, backgroundColor: C.ink2, marginBottom: 14 }),
    caps(26, C.muted, label),
  ]);
  return framed(CERT.w, CERT.h, 64, [
    { type: "img", props: { src: seal, width: 190, height: 190, style: { marginBottom: 26 } } },
    caps(40, C.ink, "WVSU journal for law advocacy"),
    caps(24, C.muted, "west visayas state university college of law", { marginTop: 10 }),
    fleuronOf(220, 40, "26px 0"),
    serif(118, C.ink, "Certificate of Publication", { letterSpacing: -1 }),
    italic(46, C.muted, "This certifies that", { marginTop: 30 }),
    serif(98, C.plum, name, { marginTop: 10, maxWidth: CERT.w * 0.8, justifyContent: "center" }),
    italic(46, C.muted, "is the author of", { marginTop: 18 }),
    // the full title, always (a certificate must not truncate); smaller type for long titles
    serif(title.length > 160 ? 42 : title.length > 110 ? 50 : 60, C.ink, `“${title}”`, { marginTop: 14, maxWidth: CERT.w * 0.74, justifyContent: "center", lineHeight: 1.15 }),
    body(36, C.ink2, `published in Volume ${volume} of the WVSU Journal for Law Advocacy, Academic Year ${ay}${pages ? `, ${pages}` : ""}.`, { marginTop: 30 }),
    body(28, C.muted, issn, { marginTop: 10 }),
    el("div", { display: "flex", justifyContent: "space-between", width: 1400, marginTop: 70 }, [sigLine("executive editor"), sigLine("faculty adviser")]),
    body(22, C.muted, verify, { marginTop: 40 }),
  ]);
}

// Volume launch carousel (Instagram, 4:5)
const SL = { w: 1080, h: 1350 };
function slideCover({ volume, ay, theme, host, seal }) {
  return framed(SL.w, SL.h, 44, [
    { type: "img", props: { src: seal, width: 170, height: 170, style: { marginBottom: 30 } } },
    caps(30, C.ink, "WVSU journal for law advocacy"),
    fleuronOf(130, 30, "26px 0"),
    serif(230, C.gold, roman(volume), { lineHeight: 1 }),
    caps(58, C.ink, `volume ${volume}`, { marginTop: 16 }),
    italic(42, C.muted, `Academic Year ${ay}`, { marginTop: 14 }),
    ...(theme ? [serif(50, C.ink2, theme, { marginTop: 22, maxWidth: SL.w * 0.75, justifyContent: "center" })] : []),
    caps(34, C.plum, "now online", { marginTop: 50 }),
    caps(22, C.gold, host, { marginTop: 18, letterSpacing: 2 }),
  ]);
}
function slideContents({ volume, items, start, page, pages }) {
  return framed(SL.w, SL.h, 44, [
    caps(26, C.gold, `volume ${volume} · ${page} of ${pages}`),
    serif(70, C.ink, "In this volume", { marginTop: 10 }),
    fleuronOf(110, 28, "18px 0 26px"),
    el("div", { display: "flex", flexDirection: "column", width: SL.w * 0.8, gap: 26 }, items.map((a, i) =>
      el("div", { display: "flex", gap: 22, alignItems: "flex-start", textAlign: "left", paddingBottom: 22, borderBottom: i < items.length - 1 ? `1px solid ${C.gold2}` : "0" }, [
        serif(34, C.gold, `${roman(start + i + 1)}.`, { width: 90, justifyContent: "flex-end", flexShrink: 0 }),
        el("div", { display: "flex", flexDirection: "column", flex: 1 }, [
          serif(33, C.ink, clip(a.title, 130), { lineHeight: 1.15 }),
          caps(20, C.plum, a.author.toLowerCase(), { marginTop: 8 }),
        ]),
      ]))),
  ], "flex-start");
}
function slideClosing({ volume, host, issn, seal }) {
  return framed(SL.w, SL.h, 44, [
    { type: "img", props: { src: seal, width: 200, height: 200, style: { marginBottom: 40 } } },
    serif(84, C.ink, "Read the full volume", { maxWidth: SL.w * 0.75, justifyContent: "center" }),
    fleuronOf(130, 30, "30px 0"),
    italic(40, C.muted, "Free and open access, every article with its own page, PDF, and citation."),
    caps(34, C.plum, host, { marginTop: 50, letterSpacing: 3 }),
    body(26, C.muted, `Volume ${volume} · ${issn}`, { marginTop: 24 }),
  ]);
}

export async function generateShareCards({ articles, issues = [], site, outDir, onlyMissing = false }) {
  const { default: satori } = await import("satori");
  const { Resvg } = await import("@resvg/resvg-js");
  const fonts = [
    { name: "Cormorant Garamond", data: font("cormorant-garamond-600.woff"), weight: 600, style: "normal" },
    { name: "Cormorant Garamond", data: font("cormorant-garamond-500-italic.woff"), weight: 500, style: "italic" },
    { name: "Cormorant SC", data: font("cormorant-sc-600.woff"), weight: 600, style: "normal" },
    { name: "Newsreader", data: font("newsreader-400.woff"), weight: 400, style: "normal" },
  ];
  const seal = "data:image/png;base64," + fs.readFileSync("src/assets/img/seal-240.png").toString("base64");
  const ogDir = outDir, shareDir = path.join(path.dirname(outDir), "share");
  fs.mkdirSync(ogDir, { recursive: true }); fs.mkdirSync(shareDir, { recursive: true });

  const render = async (file, fmt, props) => {
    if (onlyMissing && fs.existsSync(file)) return;
    const f = FORMATS[fmt];
    const svg = await satori(card(f, { ...props, seal }), { width: f.w, height: f.h, fonts });
    fs.writeFileSync(file, new Resvg(svg, { fitTo: { mode: "width", value: f.w } }).render().asPng());
  };

  const issn = site.issn_print ? ` · ISSN ${site.issn_print}` : "";
  const host = String(site.url || "").replace(/^https?:\/\//, "").replace(/\/$/, "").toLowerCase();
  await render(path.join(ogDir, "site.png"), "og", {
    kicker: "est. mmxxi · iloilo city", title: "Scholarship on Philippine law, legal practice, and the public interest",
    author: "The Editorial Board", meta: `Open access${issn}`,
  });
  for (const a of articles) {
    const props = { kicker: "published in", title: a.title, author: a.author, meta: `Volume ${a.volume} · ${a.year}${issn}`, host };
    await render(path.join(ogDir, `${a.slug}.png`), "og", props);
    await render(path.join(shareDir, `${a.slug}-post.png`), "post", props);
    await render(path.join(shareDir, `${a.slug}-story.png`), "story", props);
  }
  console.log(`[share] ${articles.length * 3 + 1} images in ${ogDir} and ${shareDir}`);

  // ---- certificates of publication (PNG + A4 landscape PDF) ----
  const { PDFDocument } = await import("pdf-lib");
  const certDir = path.join(path.dirname(outDir), "certificates"); fs.mkdirSync(certDir, { recursive: true });
  const ayOf = (v) => (issues.find((i) => Number(i.volume) === Number(v)) || {}).academic_year || "";
  let nCert = 0;
  for (const a of articles) {
    const pages = a.first_page ? (a.last_page && a.last_page !== a.first_page ? `pages ${a.first_page}–${a.last_page}` : `page ${a.first_page}`) : "";
    for (const au of a.authors || []) {
      const png = path.join(certDir, `${au.file}.png`), pdf = path.join(certDir, `${au.file}.pdf`);
      if (onlyMissing && fs.existsSync(pdf)) continue;
      const svg = await satori(certificate({
        name: au.name, title: a.title, volume: a.volume, ay: ayOf(a.volume), pages,
        issn: site.issn_print ? `ISSN ${site.issn_print}` : "", seal,
        verify: au.slug === "editors" ? `Verify at ${host}${a.url}` : `Verify at ${host}/authors/${au.slug}/`,
      }), { width: CERT.w, height: CERT.h, fonts });
      const bytes = new Resvg(svg, { fitTo: { mode: "width", value: CERT.w } }).render().asPng();
      fs.writeFileSync(png, bytes);
      const doc = await PDFDocument.create();
      doc.setTitle(`Certificate of Publication: ${au.name}`); doc.setAuthor(site.title); doc.setSubject(a.title); doc.setCreator(site.title); doc.setProducer(site.title);
      const img = await doc.embedPng(bytes);
      const pg = doc.addPage([841.89, 595.28]); // A4 landscape, points
      pg.drawImage(img, { x: 0, y: 0, width: 841.89, height: 595.28 });
      fs.writeFileSync(pdf, await doc.save());
      nCert++;
    }
  }

  // ---- volume launch carousels ----
  let nSlides = 0;
  for (const v of issues) {
    if (!v.articles || !v.articles.length) continue;
    const dir = path.join(shareDir, `volume-${v.volume}`); fs.mkdirSync(dir, { recursive: true });
    const chunks = []; for (let i = 0; i < v.articles.length; i += 5) chunks.push(v.articles.slice(i, i + 5));
    const slides = [
      slideCover({ volume: v.volume, ay: v.academic_year, theme: v.theme, host, seal }),
      ...chunks.slice(0, 17).map((items, k) => slideContents({ volume: v.volume, items, start: k * 5, page: k + 1, pages: Math.min(chunks.length, 17) })),
      slideClosing({ volume: v.volume, host, issn: site.issn_print ? `ISSN ${site.issn_print}` : "", seal }),
    ];
    for (let k = 0; k < slides.length; k++) {
      const file = path.join(dir, `slide-${String(k + 1).padStart(2, "0")}.png`);
      if (onlyMissing && fs.existsSync(file)) continue;
      const svg = await satori(slides[k], { width: SL.w, height: SL.h, fonts });
      fs.writeFileSync(file, new Resvg(svg, { fitTo: { mode: "width", value: SL.w } }).render().asPng());
      nSlides++;
    }
  }
  console.log(`[share] ${nCert} certificates in ${certDir}; ${nSlides} carousel slides`);
}
