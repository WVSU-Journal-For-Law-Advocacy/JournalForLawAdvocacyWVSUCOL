import fs from "node:fs";
import markdownItFootnote from "markdown-it-footnote";
import { generateShareCards } from "./og-cards.js";

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
  eleventyConfig.amendLibrary("md", (md) => md.use(markdownItFootnote));
  const stripTags = (s) => s.replace(/<[^>]+>/g, "").trim();
  eleventyConfig.addFilter("headingIds", (html) => {
    const seen = new Set();
    return String(html || "").replace(/<h([23])>([\s\S]*?)<\/h\1>/g, (_, level, inner) => {
      let id = slugify(stripTags(inner)) || "section"; while (seen.has(id)) id += "-";
      seen.add(id);
      return `<h${level} id="${id}">${inner}</h${level}>`;
    });
  });
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
      slug: page.fileSlug, title: data.title, author: data.author, volume: data.volume, year: data.year, kind: data.kind,
    }));
    return list;
  });

  eleventyConfig.addCollection("issues", (api) =>
    api.getFilteredByGlob("src/issues/*.md").sort((a, b) =>
      num(b.data.volume) - num(a.data.volume) || num(b.data.issue) - num(a.data.issue)
    )
  );

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

  // JSON safe to place inside a <script> tag
  eleventyConfig.addFilter("jsonScript", (value) =>
    JSON.stringify(value).replace(/</g, "\\u003c")
  );

  eleventyConfig.addShortcode("year", () => String(new Date().getFullYear()));

  // Facebook / social share images, written straight into _site/og/
  eleventyConfig.on("eleventy.after", async ({ dir, runMode }) => {
    const site = JSON.parse(fs.readFileSync("src/_data/site.json", "utf8"));
    await generateShareCards({ articles: shareCardArticles, site, outDir: `${dir.output}/og`, onlyMissing: runMode !== "build" });
  });

  return {
    dir: { input: "src", includes: "_includes", data: "_data", output: "_site" },
    // Markdown written in the CMS is never run through a template engine
    markdownTemplateEngine: false,
    htmlTemplateEngine: "njk",
  };
}
