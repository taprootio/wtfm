import { applyPathPrefix, toRootAbsoluteUrl } from "./urls.js";

export { applyPathPrefix } from "./urls.js";

export const HELP_MANIFEST_SCHEMA_VERSION = 1;

function normalizePageUrl(value) {
  const url = toRootAbsoluteUrl(value);
  if (!url || url.startsWith("#")) return url;
  const parsed = new URL(url, "https://wtfm.invalid");
  const pathname = parsed.pathname
    .replace(/\/index\.html$/u, "/")
    .replace(/\/+$/u, "") || "/";
  return `${pathname}${parsed.search}${parsed.hash}`;
}

/**
 * Extract ordered heading ids from final HTML and reject duplicates.
 *
 * @param {string} html
 * @param {string} [context="help document"]
 * @returns {string[]}
 */
export function extractHelpHeadingIds(html, context = "help document") {
  const ids = [];
  const seen = new Set();
  const headingPattern = /<h[1-6]\b[^>]*?\s+id\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>/giu;
  let match;

  while ((match = headingPattern.exec(String(html ?? ""))) !== null) {
    const id = match[1] ?? match[2] ?? match[3];
    if (seen.has(id)) {
      throw new Error(
        `wtfm: Duplicate help heading id "${id}" in ${context}.`,
      );
    }
    seen.add(id);
    ids.push(id);
  }

  return ids;
}

function findPage(results, url, surfaceSlug, kind) {
  const expected = normalizePageUrl(url);
  const matches = (results ?? []).filter(
    (result) => normalizePageUrl(result.url) === expected,
  );

  if (matches.length === 0) {
    throw new Error(
      `wtfm: Surface "${surfaceSlug}" is missing its ${kind} page at "${url}".`,
    );
  }
  if (matches.length > 1) {
    throw new Error(
      `wtfm: Surface "${surfaceSlug}" has ${matches.length} ${kind} pages at "${url}".`,
    );
  }
  return matches[0];
}

/**
 * Build the versioned help link/anchor index from final Eleventy results.
 *
 * @param {object[]} surfaces
 * @param {object[]} results
 * @param {object} [options]
 * @param {string} [options.pathPrefix="/"]
 * @returns {{schemaVersion: number, surfaces: object[]}}
 */
export function buildHelpManifest(surfaces, results, options = {}) {
  const { pathPrefix = "/" } = options;
  const entries = (surfaces ?? []).map((surface) => {
    const referencePage = findPage(
      results,
      surface.referenceUrl,
      surface.slug,
      "reference",
    );
    const helpPage = findPage(results, surface.helpUrl, surface.slug, "help");

    return {
      slug: surface.slug,
      referenceUrl: applyPathPrefix(referencePage.url, pathPrefix),
      helpUrl: applyPathPrefix(helpPage.url, pathPrefix),
      anchors: extractHelpHeadingIds(
        helpPage.content,
        `surface "${surface.slug}" help page`,
      ),
    };
  });

  return {
    schemaVersion: HELP_MANIFEST_SCHEMA_VERSION,
    surfaces: entries,
  };
}
