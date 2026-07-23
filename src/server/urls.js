import posthtml from "posthtml";
import posthtmlUrls from "@11ty/posthtml-urls";

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

/**
 * Apply a deployment path prefix to one root-absolute internal URL.
 * Relative and external values are intentionally left alone.
 *
 * @param {string} value
 * @param {string} [pathPrefix="/"]
 * @returns {string}
 */
export function applyPathPrefix(value, pathPrefix = "/") {
  const url = String(value ?? "").trim();
  if (!url.startsWith("/") || url.startsWith("//")) return url;

  const prefix = normalizeUrlPrefix(pathPrefix);
  if (prefix === "/") return url;
  const parsed = new URL(url, "https://wtfm.invalid");
  const pathname = `${prefix.replace(/\/$/u, "")}/${parsed.pathname.replace(/^\//u, "")}`;
  return `${pathname}${parsed.search}${parsed.hash}`;
}

/**
 * Prefix root-absolute URLs inside HTML before the markup is base64 encoded.
 * This covers URL-bearing attributes (including srcset) without rewriting
 * scripts, text, relative URLs, fragments, data URLs, or external URLs.
 *
 * @param {string} html
 * @param {string} [pathPrefix="/"]
 * @returns {Promise<string>}
 */
export async function applyPathPrefixToHtml(html, pathPrefix = "/") {
  if (normalizeUrlPrefix(pathPrefix) === "/") return String(html ?? "");

  const result = await posthtml()
    .use(posthtmlUrls({
      eachURL(url) {
        return applyPathPrefix(url, pathPrefix);
      },
    }))
    .process(String(html ?? ""));
  return result.html;
}
