export default {
  layout: "layouts/issue.njk",
  eleventyComputed: {
    permalink: (data) => `/archive/volume-${data.volume}/`,
  },
};