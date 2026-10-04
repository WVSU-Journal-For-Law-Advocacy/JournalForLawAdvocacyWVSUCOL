import fs from "node:fs";
import markdownItFootnote from "markdown-it-footnote";
import { generateShareCards } from "./og-cards.js";
import { pickCovers, coverSrc } from "./covers.js";

export default function (eleventyConfig) {
  // Static files copied as-is
  eleventyConfig.addPassthroughCopy("src/assets");
  eleventyConfig.addPassthroughCopy("src/uploads");
  eleventyConfig.addPassthroughCopy("src/admin");
  eleventyConfig.addPassthroughCopy({ "src/assets/img/favicon.png": "favicon.png" });

  // Entries marked "draft" in the CMS are left out of production builds
  eleventyConfig.addPreprocessor("drafts", "*", (data) => {
    if (data.draft && process.env.ELEVENTY_RUN_MODE === "build") return false;
  });

  const num = (v) => Number(v) || 0;
  const slugify = (s) => eleventyConfig.getFilter("slugify")(s);

  // ---- Full-text articles: footnotes ([^1]) and a table of contents from h2/h3 ----
  // linkify: bare URLs in bibliographies become links
  let mdLib;
  eleventyConfig.amendLibrary("md", (md) => {
    mdLib = md.set({ linkify: true }).use(markdownItFootnote);
    // law-review style markers: a bare superscript number, not "[1]"
    md.renderer.rules.footnote_caption = (tokens, idx) => {
      const n = Number(tokens[idx].meta.id + 1).toString();
      return tokens[idx].meta.subId > 0 ? `${n}:${tokens[idx].meta.subId}` : n;
    };
  });
  // Markdown stored in data files (e.g. the call for papers)
  eleventyConfig.addFilter("md", (s) => (s && mdLib ? mdLib.render(String(s)) : ""));

  // ---- "By the numbers": everything computed from the collections at build time ----
  eleventyConfig.addFilter("journalStats", (articles, issues, authors, areas) => {
    const count = (key, order) => {
      const m = new Map((order || []).map((k) => [k, 0]));
      for (const a of articles) m.set(a.data[key], (m.get(a.data[key]) || 0) + 1);
      return [...m].filter(([, n]) => n > 0).map(([label, n]) => ({ label, n }));
    };
    const byArea = count("area", areas).sort((a, b) => b.n - a.n);
    const byKind = count("kind").sort((a, b) => b.n - a.n);
    const byVolume = issues.map((i) => ({
      label: `Volume ${i.data.volume}`, sub: i.data.academic_year, url: i.url,
      n: articles.filter((a) => num(a.data.volume) === num(i.data.volume)).length,
    })).sort((a, b) => num(a.label.slice(7)) - num(b.label.slice(7)));
    const pages = articles.reduce((s, a) => s + (a.data.first_page && a.data.last_page ? a.data.last_page - a.data.first_page + 1 : 0), 0);
    const fullText = articles.filter((a) => a.data.fulltext_status).length; // every web full text carries a status
    const max = (list) => Math.max(1, ...list.map((x) => x.n));
    return {
      pieces: articles.length, authors: authors.length, volumes: issues.length, pages, fullText,
      byArea, byKind, byVolume, maxArea: max(byArea), maxKind: max(byKind), maxVolume: max(byVolume),
    };
  });
  // footnote markers inside a heading must not leak into its id or the contents list
  const stripTags = (s) => s.replace(/<sup class="footnote-ref">[\s\S]*?<\/sup>/g, "").replace(/<[^>]+>/g, "").trim();
  eleventyConfig.addFilter("headingIds", (html) => {
    const seen = new Set();
    return String(html || "").replace(/<h([23])>([\s\S]*?)<\/h\1>/g, (_, level, inner) => {
      let id = slugify(stripTags(inner)) || "section"; while (seen.has(id)) id += "-";
      seen.add(id);
      return `<h${level} id="${id}">${inner}</h${level}>`;
    });
  });
  // Separate markdown-it-footnote's notes section so the page can show it in its own panel
  eleventyConfig.addFilter("splitFootnotes", (html) => {
    const s = String(html || "");
    const at = s.indexOf('<hr class="footnotes-sep">');
    if (at < 0) return { main: s, notes: "", count: 0 };
    const notes = s.slice(at).replace('<hr class="footnotes-sep">', "");
    return { main: s.slice(0, at), notes, count: (notes.match(/<li id="fn\d+"/g) || []).length };
  });
  // ---- author profiles: optional CMS profile, else the board photo of the same person ----
  eleventyConfig.addFilter("profileFor", (person, profiles, board) => {
    const p = ((profiles && profiles.profiles) || []).find((x) => x.slug === person.slug) || {};
    const member = ((board && board.boards) || []).flatMap((b) => b.members).find((m) => canonical(m.name) === person.name);
    const role = !member ? "" : member.role.includes(member.group) ? member.role : `${member.role}, ${member.group}`;
    return { ...p, photo: p.photo || (member && member.photo) || "", role };
  });
  eleventyConfig.addFilter("monogram", (name) => {
    const parts = String(name || "").replace(/,?\s+(Jr\.|Sr\.|III|II|IV)$/, "").split(/\s+/).filter((w) => !/\.$/.test(w) || w.length > 2);
    return ((parts[0] || "")[0] || "") + ((parts[parts.length - 1] || "")[0] || "");
  });
  // the piece marked "featured" in the CMS, otherwise the first one
  eleventyConfig.addFilter("featuredOf", (list) => (list || []).find((a) => a.data.featured) || (list || [])[0]);
  eleventyConfig.addFilter("roman", (n) => {
    let x = num(n), out = "";
    for (const [v, s] of [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]]) while (x >= v) { out += s; x -= v; }
    return out;
  });
  // minutes to read, at ~230 words a minute (footnotes excluded)
  eleventyConfig.addFilter("readingTime", (html) => {
    const words = String(html || "").replace(/<sup class="footnote-ref">[\s\S]*?<\/sup>/g, "").replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
    return words > 150 ? Math.max(1, Math.round(words / 230)) : 0;
  });
  eleventyConfig.addFilter("exceptUrl", (items, url) => (items || []).filter((x) => x.url !== url));
  eleventyConfig.addFilter("headings", (html) =>
    [...String(html || "").matchAll(/<h([23]) id="([^"]+)">([\s\S]*?)<\/h\1>/g)].map(([, level, id, inner]) => ({ level: +level, id, text: stripTags(inner) }))
  );

  // Newest issue first, then by first page (or `order` for unpaginated issues)
  const position = (a) => num(a.data.first_page) || num(a.data.order);
  let shareCardArticles = [];
  eleventyConfig.addCollection("articles", (api) => {
    const list = api.getFilteredByGlob("src/articles/*.md").sort((a, b) =>
      num(b.data.volume) - num(a.data.volume) ||
      num(b.data.issue) - num(a.data.issue) ||
      position(a) - position(b)
    );
    shareCardArticles = list.map(({ page, data }) => ({
      slug: page.fileSlug, title: data.title, author: data.author, volume: data.volume, year: data.year, kind: data.kind, area: data.area,
      first_page: data.first_page, last_page: data.last_page, url: page.url, authors: certificatesFor(data.author, page.fileSlug),
    }));
    return list;
  });

  // Cover photos for the app (Unsplash, chosen once and remembered; see covers.js). A list of { slug, ...photo }.
  eleventyConfig.addCollection("coverPhotos", async (api) => {
    try {
      const articles = api.getFilteredByGlob("src/articles/*.md").map(({ page, data }) => ({ slug: page.fileSlug, area: data.area, keywords: data.keywords, cover_photo: data.cover_photo }));
      const issues = api.getFilteredByGlob("src/issues/*.md").map(({ data }) => ({ volume: data.volume, cover_photo: data.cover_photo }));
      const map = await pickCovers({ articles, issues });
      return Object.entries(map).map(([slug, c]) => ({ slug, ...c }));
    } catch (e) { console.warn("[covers]", e.message); return []; }
  });
  eleventyConfig.addFilter("coverFor", (slug, list) => (list || []).find((c) => c.slug === slug) || null);
  eleventyConfig.addFilter("coverSrc", (c, w) => coverSrc(c, w));

  let shareCardIssues = [];
  eleventyConfig.addCollection("issues", (api) => {
    const list = api.getFilteredByGlob("src/issues/*.md").sort((a, b) =>
      num(b.data.volume) - num(a.data.volume) || num(b.data.issue) - num(a.data.issue)
    );
    shareCardIssues = list.map(({ page, data }) => ({ volume: data.volume, issue: data.issue, title: data.title, academic_year: data.academic_year, theme: data.theme, url: page.url }));
    return list;
  });

  // ---- Certificates of publication: one per author of each piece ----
  // [{ name: as printed, slug, file: "<article>--<author>" }]
  // (editorials signed "From the Editors' Desk" get none: certificates are for people)
  function certificatesFor(author, articleSlug) {
    return splitAuthors(author).filter(isPerson).map((name) => {
      const slug = slugify(canonical(name));
      return { name, slug, file: `${articleSlug}--${slug}` };
    });
  }
  eleventyConfig.addFilter("certificates", (author, articleSlug) => certificatesFor(author, articleSlug));
  // LinkedIn has a deep link only for "Licenses & certifications"
  eleventyConfig.addFilter("linkedinCert", (d, site) => {
    const p = new URLSearchParams({
      startTask: "CERTIFICATION_NAME",
      name: `Published Author: ${site.title}, Vol. ${d.volume}`,
      organizationName: `${site.title}, ${site.institution}`,
      issueYear: String(d.year), issueMonth: "1",
      certUrl: d.url, certId: `JLA-${d.volume}${d.first_page ? "-" + d.first_page : ""}-${d.slug.slice(0, 24).replace(/-+$/, "")}`,
    });
    return "https://www.linkedin.com/profile/add?" + p.toString();
  });

  eleventyConfig.addCollection("policies", (api) =>
    api.getFilteredByGlob("src/policies/*.md").sort((a, b) => num(a.data.order) - num(b.data.order))
  );

  eleventyConfig.addCollection("news", (api) =>
    api.getFilteredByGlob("src/news/*.md").sort((a, b) => b.date - a.date)
  );

  // ---- Authors ----
  // "A and B" / "A; B" -> ["A", "B"]; credentials like ", JD" stay attached
  const splitAuthors = (s) => String(s || "").split(/\s+and\s+|;\s*/).map((x) => x.trim()).filter(Boolean);
  // One person may be printed several ways ("Atty. …", with or without middle initial).
  // Titles and credentials are dropped, then src/_data/authorAliases.json maps variants to one name.
  const aliases = JSON.parse(fs.readFileSync("src/_data/authorAliases.json", "utf8"));
  const canonical = (raw) => {
    const bare = raw.replace(/^(Atty|Judge|Prosec|Dr|Justice|Hon)\.?\s+/i, "").replace(/,\s*(JD|RN|MAN|LLM|PhD)\b.*$/i, "").trim();
    return aliases[bare] || bare;
  };
  const familyName = (name) => name.replace(/,?\s+(Jr\.|Sr\.|III|II|IV)$/, "").split(/\s+/).pop();

  eleventyConfig.addFilter("splitAuthors", splitAuthors);
  eleventyConfig.addFilter("personList", (names) => names.map((name) => ({ "@type": "Person", name })));
  // [{ name: as printed, slug }] for linking each author of a piece
  const isPerson = (name) => !/editors|desk/i.test(name);
  eleventyConfig.addFilter("authorLinks", (s) =>
    splitAuthors(s).map((name) => ({ name, slug: isPerson(name) ? slugify(canonical(name)) : "" }))
  );

  eleventyConfig.addCollection("authors", (api) => {
    const people = new Map();
    for (const a of api.getFilteredByGlob("src/articles/*.md")) {
      for (const raw of splitAuthors(a.data.author)) {
        const name = canonical(raw);
        if (!isPerson(name)) continue; // editorials are not personal bylines
        const slug = slugify(name);
        if (!people.has(slug)) people.set(slug, { name, slug, family: familyName(name), articles: [] });
        people.get(slug).articles.push(a);
      }
    }
    const list = [...people.values()];
    for (const p of list) p.articles.sort((x, y) => num(y.data.volume) - num(x.data.volume) || position(x) - position(y));
    return list.sort((x, y) => x.family.localeCompare(y.family) || x.name.localeCompare(y.name));
  });

  // ---- Lookups ----
  // The issue marked "current", otherwise the newest published one
  eleventyConfig.addFilter("currentIssue", (issues) =>
    issues.find((i) => i.data.status === "current") ||
    issues.find((i) => i.data.status === "published") ||
    issues[0]
  );

  eleventyConfig.addFilter("inIssue", (articles, volume, issue) =>
    articles.filter((a) => num(a.data.volume) === num(volume) && num(a.data.issue) === num(issue))
  );

  eleventyConfig.addFilter("byArea", (articles, area) => articles.filter((a) => a.data.area === area));

  eleventyConfig.addFilter("where", (items, key, value) => (items || []).filter((x) => x[key] === value));

  eleventyConfig.addFilter("issueOf", (issues, volume, issue) =>
    issues.find((i) => num(i.data.volume) === num(volume) && num(i.data.issue) === num(issue))
  );

  // Edit this to match the journal's house citation style
  eleventyConfig.addFilter("cite", (d, abbrev) =>
    `${d.author}, ${d.title}, ${d.volume} ${abbrev}${d.first_page ? " " + d.first_page : ""} (${d.year}).` +
    (d.doi ? ` https://doi.org/${d.doi}` : "")
  );

  eleventyConfig.addFilter("readableDate", (d) =>
    new Date(d).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })
  );
  eleventyConfig.addFilter("isoDate", (d) => new Date(d).toISOString().slice(0, 10));
  // /api/articles.json: what reader accounts need to count, suggest and award badges
  const wordsIn = (md) => String(md || "")
    .replace(/^\[\^[^\]]+\]:.*$/gm, " ")        // footnote definitions
    .replace(/\[\^[^\]]+\]/g, " ")              // footnote markers
    .replace(/[#>*_`|[\]()-]/g, " ")
    .split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
  eleventyConfig.addFilter("articleIndex", (articles, issues, covers = []) => articles.map((a) => {
    const vol = issues.find((i) => num(i.data.volume) === num(a.data.volume));
    const words = wordsIn(a.rawInput);
    return {
      slug: a.page.fileSlug, url: a.url, title: a.data.title, authors: splitAuthors(a.data.author),
      volume: num(a.data.volume), year: a.data.year, area: a.data.area, kind: a.data.kind,
      keywords: a.data.keywords || [], words, text: words > 150,
      launched: vol && vol.data.launched ? new Date(vol.data.launched).toISOString().slice(0, 10) : null,
      cover: coverSrc((covers || []).find((c) => c.slug === a.page.fileSlug), 300) || undefined,
    };
  }));
  // a fresh id per build: names the service worker's cache so each deploy refreshes the app shell
  const BUILD_ID = Date.now().toString(36);
  eleventyConfig.addFilter("buildId", () => BUILD_ID);
  // Top-menu item is "current" when the page is under its URL or any of its sub-links
  eleventyConfig.addFilter("navActive", (item, url = "") =>
    [item.url, ...(item.sub || []).map((s) => s[0])].some((u) => url.startsWith(u))
  );
  // Archive plates: published issues plus placeholders for volumes not yet online, newest first
  eleventyConfig.addFilter("withComingSoon", (issues, soon = []) => {
    const have = new Set(issues.map((i) => num(i.data.volume)));
    const placeholders = soon.map(num).filter((v) => !have.has(v)).map((v) => ({ soon: true, data: { volume: v, title: `Volume ${v}` } }));
    return [...issues, ...placeholders].sort((a, b) => num(b.data.volume) - num(a.data.volume));
  });
  // For posts whose exact day is unknown (date_approx: true)
  eleventyConfig.addFilter("monthYear", (d) =>
    new Date(d).toLocaleDateString("en-PH", { year: "numeric", month: "long", timeZone: "UTC" })
  );
  // News posts flagged as milestones, oldest first, grouped by year: [{ year, items }]
  eleventyConfig.addFilter("milestonesByYear", (news) => {
    const groups = [];
    for (const n of news.filter((n) => n.data.milestone).sort((a, b) => a.date - b.date)) {
      const year = new Date(n.date).getUTCFullYear();
      if (!groups.length || groups.at(-1).year !== year) groups.push({ year, items: [] });
      groups.at(-1).items.push(n);
    }
    return groups;
  });

  // JSON safe to place inside a <script> tag
  eleventyConfig.addFilter("jsonScript", (value) =>
    JSON.stringify(value).replace(/</g, "\\u003c")
  );

  eleventyConfig.addShortcode("year", () => String(new Date().getFullYear()));

  // ---- Records of publication and of editorial service (/verify/…) ----
  // everyone who has served on the board, with their roles by year (newest first): [{ name, slug, roles: [{ year, role, group }] }]
  eleventyConfig.addCollection("editors", () => {
    let board = { boards: [] }; try { board = JSON.parse(fs.readFileSync("src/_data/board.json", "utf8")); } catch (e) {}
    const people = new Map();
    for (const b of board.boards || []) for (const m of b.members || []) {
      const name = canonical(m.name), slug = slugify(name);
      if (!people.has(slug)) people.set(slug, { name, slug, photo: m.photo || "", roles: [] });
      people.get(slug).roles.push({ year: b.academic_year, role: m.role, group: m.group });
    }
    return [...people.values()].sort((a, b) => a.name.localeCompare(b.name));
  });
  eleventyConfig.addFilter("editorSlug", (name) => slugify(canonical(name)));
  // the board that edited a volume: the one whose academic year matches the volume's
  eleventyConfig.addFilter("boardOfYear", (board, ay) => ((board && board.boards) || []).find((b) => b.academic_year === ay) || null);
  eleventyConfig.addFilter("execEditorOf", (b) => (b ? (b.members || []).find((m) => /^executive editor$/i.test(m.role)) : null) || null);
  // a short, stable record number: JLA-V5-120 (volume and first page), or the slug when there's no page
  eleventyConfig.addFilter("recordId", (d) => `JLA-V${num(d.volume)}-${d.first_page || String(d.slug || "").slice(0, 12).toUpperCase()}`);
  // the role as one CV line: "Member, Board of Editors" stays; "Executive Editor" stays; otherwise "Role, Group"
  eleventyConfig.addFilter("roleLine", (r) => (r.role.includes(r.group) || !r.group ? r.role : `${r.role}, ${r.group}`));

  // Facebook / social share images, written straight into _site/og/
  eleventyConfig.on("eleventy.after", async ({ dir, runMode }) => {
    const site = JSON.parse(fs.readFileSync("src/_data/site.json", "utf8"));
    const byVolume = (v) => shareCardArticles.filter((a) => num(a.volume) === num(v));
    // Certificates are switched off in site settings until the board approves them
    const articles = site.certificates ? shareCardArticles : shareCardArticles.map((a) => ({ ...a, authors: [] }));
    await generateShareCards({
      articles, issues: shareCardIssues.map((i) => ({ ...i, articles: byVolume(i.volume) })),
      site, outDir: `${dir.output}/og`, onlyMissing: runMode !== "build",
    });
  });

  return {
    dir: { input: "src", includes: "_includes", data: "_data", output: "_site" },
    // Markdown written in the CMS is never run through a template engine
    markdownTemplateEngine: false,
    htmlTemplateEngine: "njk",
  };
}
