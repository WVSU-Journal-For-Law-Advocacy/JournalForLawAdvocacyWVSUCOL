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
        caps(f.eyebrow, C.ink, "journal for law advocacy", { marginTop: 6 }),
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

export async function generateShareCards({ articles, site, outDir, onlyMissing = false }) {
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
}
