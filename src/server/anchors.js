import markdownItAnchor from "markdown-it-anchor";
import markdownItAttrs from "markdown-it-attrs";

/**
 * Return the complete string value stored by @wc-toolkit/jsdoc-tags.
 *
 * @param {{name?: string, description?: string} | string | undefined} tag
 * @returns {string | undefined}
 */
export function tagValue(tag) {
  if (typeof tag === "string") return tag.trim() || undefined;
  if (!tag) return undefined;
  return [tag.name, tag.description].filter(Boolean).join(" ").trim() || undefined;
}

/**
 * Produce a stable lowercase kebab-case anchor from a heading title.
 * Explicit anchor overrides do not pass through this function.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function slugifyAnchor(value) {
  const slug = String(value ?? "")
    .normalize("NFKD")
    .replace(/\p{Mark}+/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[’']/g, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");

  return slug || "section";
}

/**
 * Validate an explicit heading id. HTML ids may contain punctuation, but
 * whitespace would make fragment links ambiguous and is therefore rejected.
 *
 * @param {unknown} value
 * @param {string} [context]
 * @returns {string}
 */
export function validateAnchorId(value, context = "heading") {
  const id = String(value ?? "").trim();
  if (!id || /\s/u.test(id)) {
    throw new Error(
      `wtfm: Invalid anchor id "${id}" for ${context}; ids must be non-empty and contain no whitespace.`,
    );
  }
  return id;
}

/**
 * Resolve the id for a generated heading. Overrides preserve exact case and
 * are never namespaced; generated ids can be namespaced for surface pages.
 *
 * @param {string} title
 * @param {object} [options]
 * @param {string} [options.prefix]
 * @param {{name?: string, description?: string} | string} [options.override]
 * @param {string} [options.context]
 * @returns {string}
 */
export function resolveAnchorId(title, options = {}) {
  const { prefix, override, context = `heading "${title}"` } = options;
  const explicit = tagValue(override);
  if (explicit) return validateAnchorId(explicit, context);

  const generated = slugifyAnchor(title);
  return prefix ? `${slugifyAnchor(prefix)}--${generated}` : generated;
}

/**
 * Render a Markdown heading with an explicit id for stable renderer output.
 *
 * @param {number} level
 * @param {string} title
 * @param {object} [options]
 * @returns {string}
 */
export function renderAnchoredHeading(level, title, options = {}) {
  if (!Number.isInteger(level) || level < 1 || level > 6) {
    throw new Error(`wtfm: Invalid heading level "${level}".`);
  }
  const id = resolveAnchorId(title, options);
  return `${"#".repeat(level)} ${title} {#${id}}`;
}

/**
 * Configure markdown-it with stable heading ids and id-only explicit attrs.
 * markdown-it-anchor normally suffixes duplicate generated ids. WTFM treats
 * that as drift and throws, matching its existing behavior for duplicate
 * user-defined ids.
 *
 * @param {import("markdown-it")} markdownLib
 * @returns {import("markdown-it")}
 */
export function configureMarkdownAnchors(markdownLib) {
  markdownLib.use(markdownItAttrs, { allowedAttributes: ["id"] });
  markdownLib.use(markdownItAnchor, {
    slugify: slugifyAnchor,
    tabIndex: false,
    callback(token, { slug, title }) {
      if (token.meta?.wtfmExplicitAnchor) return;

      const expected = slugifyAnchor(title);
      if (slug !== expected) {
        throw new Error(
          `wtfm: Duplicate generated anchor id "${expected}" for heading "${title}". Add a unique heading or an explicit {#id}.`,
        );
      }
    },
  });

  // markdown-it-attrs has populated explicit ids before the anchor core rule.
  // Mark them so the duplicate-generated check can distinguish overrides.
  markdownLib.core.ruler.before("anchor", "wtfm-explicit-anchor", (state) => {
    for (const token of state.tokens) {
      if (token.type !== "heading_open" || token.attrGet("id") === null) continue;
      token.meta = { ...token.meta, wtfmExplicitAnchor: true };
    }
  });

  return markdownLib;
}
