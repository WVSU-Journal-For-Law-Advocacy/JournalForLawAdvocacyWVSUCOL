export default {
  layout: "layouts/policy.njk",
  eleventyComputed: {
    permalink: (data) => `/policies/${data.page.fileSlug}/`,
  },
};