export default {
  layout: "layouts/article.njk",
  isArticle: true,
  eleventyComputed: {
    permalink: (data) => `/articles/${data.page.fileSlug}/`,
  },
};