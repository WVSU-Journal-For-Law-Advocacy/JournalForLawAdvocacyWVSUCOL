// Builds 1200×630 PNG share cards (Facebook, Messenger, X, LinkedIn) for every article,
// plus one for the rest of the site. Runs after each Eleventy build; see eleventy.config.js.
import fs from "node:fs";
import path from "node:path";

const W = 1200, H = 630;
const C = { deep: "#2a1245", deep2: "#3d1a63", gold: "#c08f2c", goldl: "#e6c46f", text: "#ffffff", soft: "#d9d0e8" };

const font = (file) => fs.readFileSync(path.join("src/_og/fonts", file));
const el = (type, style, children) => ({ type, props: { style, children } });

// Shrink long titles so they always fit in four lines
const titleSize = (t) => (t.length <= 60 ? 64 : t.length <= 95 ? 56 : t.length <= 140 ? 46 : 40);
const clip = (t, max = 190) => (t.length > max ? t.slice(0, max - 1).replace(/\s+\S*$/, "") + "…" : t);

function card({ eyebrow, title, byline, meta, seal }) {
  return el("div", {
    width: W, height: H, display: "flex", flexDirection: "column", justifyContent: "space-between",
    padding: "60px 72px 64px", backgroundImage: `linear-gradient(135deg, ${C.deep} 0%, ${C.deep2} 100%)`,
    borderBottom: `14px solid ${C.gold}`, color: C.text,
  }, [
    el("div", { display: "flex", alignItems: "center" }, [
      { type: "img", props: { src: seal, width: 92, height: 92, style: { marginRight: 26 } } },
      el("div", { display: "flex", flexDirection: "column" }, [
        el("div", { fontFamily: "Public Sans", fontWeight: 600, fontSize: 26, letterSpacing: 3, color: C.goldl }, "JOURNAL FOR LAW ADVOCACY"),
        el("div", { fontFamily: "Public Sans", fontSize: 21, color: C.soft, marginTop: 6 }, eyebrow),
      ]),
    ]),
    el("div", { display: "flex", fontFamily: "Newsreader", fontWeight: 600, fontSize: titleSize(title), lineHeight: 1.12, letterSpacing: -0.5 }, clip(title)),
    el("div", { display: "flex", justifyContent: "space-between", alignItems: "flex-end", fontFamily: "Public Sans" }, [
      el("div", { display: "flex", fontSize: 28, color: C.text, maxWidth: 820 }, byline),
      el("div", { display: "flex", fontSize: 24, fontWeight: 600, color: C.goldl }, meta),
    ]),
  ]);
}

export async function generateShareCards({ articles, site, outDir, onlyMissing = false }) {
  const { default: satori } = await import("satori");
  const { Resvg } = await import("@resvg/resvg-js");

  const fonts = [
    { name: "Newsreader", data: font("newsreader-600.woff"), weight: 600, style: "normal" },
    { name: "Newsreader", data: font("newsreader-400-italic.woff"), weight: 400, style: "italic" },
    { name: "Public Sans", data: font("public-sans-400.woff"), weight: 400, style: "normal" },
    { name: "Public Sans", data: font("public-sans-600.woff"), weight: 600, style: "normal" },
  ];
  const seal = "data:image/png;base64," + fs.readFileSync("src/assets/img/seal-240.png").toString("base64");
  fs.mkdirSync(outDir, { recursive: true });

  const render = async (file, props) => {
    const out = path.join(outDir, file);
    if (onlyMissing && fs.existsSync(out)) return;
    const svg = await satori(card({ ...props, seal }), { width: W, height: H, fonts });
    fs.writeFileSync(out, new Resvg(svg, { fitTo: { mode: "width", value: W } }).render().asPng());
  };

  await render("site.png", {
    eyebrow: site.institution,
    title: "Scholarship on Philippine law, legal practice, and the public interest",
    byline: site.city,
    meta: "Open access",
  });
  for (const a of articles) {
    await render(`${a.slug}.png`, {
      eyebrow: a.kind || "Article",
      title: a.title,
      byline: a.author,
      meta: `Volume ${a.volume} · ${a.year}`,
    });
  }
  console.log(`[og] ${articles.length + 1} share cards in ${outDir}`);
}
