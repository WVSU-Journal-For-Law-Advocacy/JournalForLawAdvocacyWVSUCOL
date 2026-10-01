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

  // Newest issue first, then by first page (or `order` for unpaginated issues)
  const position = (a) => num(a.data.first_page) || num(a.data.order);
  eleventyConfig.addCollection("articles", (api) =>
    api.getFilteredByGlob("src/articles/*.md").sort((a, b) =>
      num(b.data.volume) - num(a.data.volume) ||
      num(b.data.issue) - num(a.data.issue) ||
      position(a) - position(b)
    )
  );

  eleventyConfig.addCollection("issues", (api) =>
    api.getFilteredByGlob("src/issues/*.md").sort((a, b) =>
      num(b.data.volume) - num(a.data.volume) || num(b.data.issue) - num(a.data.issue)
    )
  );

  eleventyConfig.addCollection("policies", (api) =>
    api.getFilteredByGlob("src/policies/*.md").sort((a, b) => num(a.data.order) - num(b.data.order))
  );

  // The issue marked "current", otherwise the newest published one
  eleventyConfig.addFilter("currentIssue", (issues) =>
    issues.find((i) => i.data.status === "current") ||
    issues.find((i) => i.data.status === "published") ||
    issues[0]
  );

  eleventyConfig.addFilter("inIssue", (articles, volume, issue) =>
    articles.filter((a) => num(a.data.volume) === num(volume) && num(a.data.issue) === num(issue))
  );

  // "A and B" / "A, B and C" -> ["A", "B", "C"]; credentials like ", JD" stay attached
  const splitAuthors = (s) => String(s || "").split(/\s+and\s+|;\s*/).map((x) => x.trim()).filter(Boolean);
  eleventyConfig.addFilter("splitAuthors", splitAuthors);
  eleventyConfig.addFilter("personList", (names) => names.map((name) => ({ "@type": "Person", name })));

  eleventyConfig.addFilter("where", (items, key, value) => (items || []).filter((x) => x[key] === value));

  eleventyConfig.addFilter("issueOf", (issues, volume, issue) =>
    issues.find((i) => num(i.data.volume) === num(volume) && num(i.data.issue) === num(issue))
  );

  // Edit this to match the journal's house citation style
  eleventyConfig.addFilter("cite", (d, abbrev) =>
    `${d.author}, ${d.title}, ${d.volume} ${abbrev}${d.first_page ? " " + d.first_page : ""} (${d.year}).` +
    (d.doi ? ` https://doi.org/${d.doi}` : "")
  );

  // JSON safe to place inside a <script> tag
  eleventyConfig.addFilter("jsonScript", (value) =>
    JSON.stringify(value).replace(/</g, "\\u003c")
  );

  eleventyConfig.addShortcode("year", () => String(new Date().getFullYear()));

  return {
    dir: { input: "src", includes: "_includes", data: "_data", output: "_site" },
    // Markdown written in the CMS is never run through a template engine
    markdownTemplateEngine: false,
    htmlTemplateEngine: "njk",
  };
}
