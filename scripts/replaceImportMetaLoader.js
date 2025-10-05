/* eslint-env node */

// eslint-disable-next-line no-undef
module.exports = function replaceImportMetaLoader(source) {
  if (typeof source !== "string") {
    return source;
  }

  return source.replace(
    /import\.meta\.webpackHot\.accept\(\);/g,
    "if (module && module.hot) { module.hot.accept(); }",
  );
};
