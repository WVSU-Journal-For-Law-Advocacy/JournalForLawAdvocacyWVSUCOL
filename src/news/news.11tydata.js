export default {
  layout: "layouts/news.njk",
  isNews: true,
  eleventyComputed: {
    permalink: (data) => `/news/${data.page.fileSlug}/`,
  },
};