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

  // Newest issue first, then by first page
  eleventyConfig.addCollection("articles", (api) =>
    api.getFilteredByGlob("src/articles/*.md").sort((a, b) =>
      num(b.data.volume) - num(a.data.volume) ||
      num(b.data.issue) - num(a.data.issue) ||
      num(a.data.first_page) - num(b.data.first_page)
    )
  );

  eleventyConfig.addCollection("issues", (api) =>
    api.getFilteredByGlob("src/issues/*.md").sort((a, b) =>
      num(b.data.volume) - num(a.data.volume) || num(b.data.issue) - num(a.data.issue)
    )
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

  // Edit this to match the journal's house citation style
  eleventyConfig.addFilter("cite", (d, abbrev) =>
    `${d.author}, ${d.title}, ${d.volume} ${abbrev} ${d.first_page} (${d.year}).`
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
