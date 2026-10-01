export default {
  layout: "layouts/issue.njk",
  searchExclude: true,
  eleventyComputed: {
    permalink: (data) => `/archive/volume-${data.volume}/`,
  },
};