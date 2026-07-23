const ABSOLUTE_SCHEME = /^[a-z][a-z\d+.-]*:/i;

/**
 * Normalize an internal site path to root-absolute form without adding an
 * Eleventy pathPrefix. Full external/protocol URLs are returned unchanged.
 *
 * @param {string} value
 * @returns {string}
 */
export function toRootAbsoluteUrl(value) {
  const url = String(value ?? "").trim();
  if (!url || url.startsWith("#") || url.startsWith("//") || ABSOLUTE_SCHEME.test(url)) {
    return url;
  }

  return url.startsWith("/") ? url : `/${url.replace(/^\.\//, "")}`;
}

/**
 * Resolve a link or image URL as if it appeared in the supplied document.
 * The result is root-absolute so Eleventy's HtmlBasePlugin can safely apply
 * the configured pathPrefix after rendering.
 *
 * @param {string} value
 * @param {string} documentUrl
 * @returns {string}
 */
export function resolveDocumentUrl(value, documentUrl) {
  const url = String(value ?? "").trim();
  if (!url || url.startsWith("#") || url.startsWith("//") || ABSOLUTE_SCHEME.test(url)) {
    return url;
  }

  const basePath = toRootAbsoluteUrl(documentUrl || "/");
  const resolved = new URL(url, `https://wtfm.invalid${basePath}`);
  return `${resolved.pathname}${resolved.search}${resolved.hash}`;
}

/**
 * Normalize a bundler URL prefix. Internal prefixes are root-absolute and end
 * in one slash; external prefixes are preserved with one trailing slash.
 *
 * @param {string} value
 * @returns {string}
 */
export function normalizeUrlPrefix(value) {
  const prefix = String(value ?? "").trim();
  if (!prefix) return "/";
  const normalized = ABSOLUTE_SCHEME.test(prefix) || prefix.startsWith("//")
    ? prefix
    : toRootAbsoluteUrl(prefix);
  return `${normalized.replace(/\/+$/, "")}/`;
}
