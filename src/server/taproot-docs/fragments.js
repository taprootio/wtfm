/**
 * Constrained semantic fragment renderer for the Taproot Docs artifact
 * (WTFM0010).
 *
 * Fragments are rendered from authored Markdown through a dedicated
 * markdown-it instance whose output is limited by construction to the
 * artifact contract's closed semantic set. Rendered `_site` HTML is never
 * treated as a fragment. The renderer's job is to fail with *authoring*
 * context (which document, which construct); the assembled artifact is still
 * serialized and validated through `@taprootio/docs-artifact`, which remains
 * the contract authority.
 *
 * Contract-facing rules encoded here:
 * - Fragment headings are `h2`–`h6` and every heading carries a canonical
 *   lowercase id. The resource title lives in the manifest, so `h1` in a
 *   fragment body is an authoring error.
 * - Cross-document links use `data-resource-key` (+ optional
 *   `data-heading-id`), never routes; `href` is only for `#local-heading`
 *   and `https://` targets.
 * - Images reference declared assets via `data-asset-key`; `src` never
 *   appears in a fragment.
 * - Code fences carry a canonical `data-language` token instead of a
 *   `language-*` class.
 */

import markdownIt from "markdown-it";
import { configureMarkdownAnchors, contextualizeAnchorError } from "../anchors.js";

// Mirrors the contract's canonical heading-id form for authoring-time
// diagnostics only; @taprootio/docs-artifact re-validates at emit.
const CANONICAL_HEADING_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const LANGUAGE_TOKEN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/u;

/**
 * Attributes this renderer may emit per tag. Anything else — including
 * markdown-it-attrs authored classes or ids on non-heading elements — is an
 * authoring error, reported with document context instead of surfacing later
 * as a bare contract diagnostic.
 */
const EMITTED_ATTRIBUTES = new Map([
  ["h2", new Set(["id"])],
  ["h3", new Set(["id"])],
  ["h4", new Set(["id"])],
  ["h5", new Set(["id"])],
  ["h6", new Set(["id"])],
  ["a", new Set(["href", "data-resource-key", "data-heading-id", "title"])],
  ["img", new Set(["alt", "data-asset-key", "width", "height", "title"])],
  ["code", new Set(["data-language"])],
  ["ol", new Set(["start"])],
]);

function fail(context, message) {
  throw new Error(`wtfm taprootDocs: ${context}: ${message}`);
}

function normalizeFenceLanguage(info, context) {
  const language = (info ?? "").trim().split(/\s+/u)[0]?.toLowerCase() ?? "";
  if (language === "") return null;
  if (!LANGUAGE_TOKEN.test(language)) {
    fail(context, `code fence language "${language}" is not a canonical token (lowercase letters, digits, '.', '_', '-').`);
  }
  return language;
}

function collectPlainText(children) {
  let text = "";
  for (const child of children ?? []) {
    if (child.type === "text" || child.type === "code_inline") text += child.content;
    else if (child.type === "softbreak" || child.type === "hardbreak") text += " ";
    else if (child.children) text += collectPlainText(child.children);
  }
  return text.replace(/\s+/gu, " ").trim();
}

function transformLink(token, { context, resolveRouteLink }) {
  const href = token.attrGet("href");
  if (href === null || href === "") {
    fail(context, "links must have a destination.");
  }
  if (href.startsWith("#") || href.startsWith("https://")) return;
  if (href.startsWith("/")) {
    const hashIndex = href.indexOf("#");
    const route = hashIndex === -1 ? href : href.slice(0, hashIndex);
    const headingId = hashIndex === -1 ? null : href.slice(hashIndex + 1);
    const target = resolveRouteLink(route);
    if (!target) {
      fail(context, `link "${href}" does not resolve to a Taproot Docs resource route.`);
    }
    const attributes = [["data-resource-key", target.resourceKey]];
    if (headingId !== null) {
      if (headingId === "") fail(context, `link "${href}" has an empty heading fragment.`);
      attributes.push(["data-heading-id", headingId]);
    }
    // Carry every non-href authored attribute through the rebuild so the
    // emitted-attribute check can pass supported ones (title) and reject the
    // rest instead of silently dropping them.
    for (const [name, value] of token.attrs ?? []) {
      if (name !== "href") attributes.push([name, value]);
    }
    token.attrs = attributes;
    return;
  }
  fail(
    context,
    `link "${href}" is not a supported fragment destination — use a site-root route (/guides/…/), a local #heading, or an https:// URL.`,
  );
}

function resolveImage(token, { context, assetsBySource }) {
  const src = token.attrGet("src") ?? "";
  const normalized = src.startsWith("./") ? src.slice(2) : src;
  const asset = assetsBySource.get(normalized);
  if (!asset) {
    fail(
      context,
      `image "${src}" is not a declared artifact asset — declare it in the document's taprootDocs.assets (or the plugin's taprootDocs.assets) and reference its source path.`,
    );
  }
  return asset;
}

function enforceEmittedAttributes(token, context) {
  if (!token.attrs || token.attrs.length === 0) return;
  const tag = token.tag?.toLowerCase() ?? "";
  const allowed = EMITTED_ATTRIBUTES.get(tag) ?? new Set();
  for (const [name] of token.attrs) {
    if (!allowed.has(name)) {
      fail(context, `<${tag}> may not carry the "${name}" attribute in a semantic fragment.`);
    }
  }
}

/**
 * Renders one authored Markdown body into a semantic fragment.
 *
 * @param {string} markdown - The document body (front matter removed).
 * @param {object} options
 * @param {string} options.context - Document identity for error messages.
 * @param {(route: string) => ({ resourceKey: string } | null)} options.resolveRouteLink
 *   Resolves a site-root route to the resource it belongs to.
 * @param {Map<string, { key: string, width: number, height: number }>} options.assetsBySource
 *   Declared assets by project-relative source path.
 * @returns {{ html: string, headings: Array<{ id: string, text: string, level: number }> }}
 */
export function renderDocsFragment(markdown, options) {
  const { context, resolveRouteLink, assetsBySource } = options;
  // Retain every authored attribute (allowedAttributes: null) so the
  // fail-closed checks below see exactly what the author wrote; the site
  // pipeline's silent id-only filtering would hide contract violations.
  const md = configureMarkdownAnchors(
    markdownIt({
      html: true,
      breaks: false,
      linkify: false,
    }),
    { allowedAttributes: null },
  );

  md.renderer.rules.fence = (tokens, index) => {
    const token = tokens[index];
    const language = normalizeFenceLanguage(token.info, context);
    const attribute = language === null ? "" : ` data-language="${language}"`;
    return `<pre><code${attribute}>${md.utils.escapeHtml(token.content)}</code></pre>\n`;
  };

  md.renderer.rules.image = (tokens, index, renderOptions, env, renderer) => {
    const token = tokens[index];
    const asset = token.meta?.taprootDocsAsset;
    const title = token.meta?.taprootDocsTitle;
    const alt = renderer.renderInlineAsText(token.children ?? [], renderOptions, env);
    return `<img data-asset-key="${md.utils.escapeHtml(asset.key)}"`
      + ` alt="${md.utils.escapeHtml(alt)}"`
      + ` width="${asset.width}" height="${asset.height}"`
      + (title == null ? "" : ` title="${md.utils.escapeHtml(title)}"`)
      + ">";
  };

  let tokens;
  try {
    tokens = md.parse(markdown, {});
  } catch (error) {
    throw contextualizeAnchorError(error, context);
  }

  const headings = [];
  const walkInline = (children) => {
    for (const child of children ?? []) {
      if (child.type === "html_inline") {
        fail(context, `raw HTML (${child.content.trim()}) is not part of the semantic fragment contract.`);
      }
      if (child.type === "link_open") transformLink(child, { context, resolveRouteLink });
      if (child.type === "image") {
        const asset = resolveImage(child, { context, assetsBySource });
        child.meta = {
          ...child.meta,
          taprootDocsAsset: asset,
          taprootDocsTitle: child.attrGet("title"),
        };
        for (const [name, value] of child.attrs ?? []) {
          // src and title are consumed above; the parser always stamps an
          // empty alt placeholder (real alt text comes from the children).
          if (name === "src" || name === "title") continue;
          if (name === "alt" && value === "") continue;
          if (name === "alt") {
            fail(context, `image alt must be written in Markdown form (![alt text](…)), not as an {alt=…} attribute.`);
          }
          fail(
            context,
            `image attribute "${name}" is not supported — image identity and dimensions come from the declared asset.`,
          );
        }
        child.attrs = [];
        walkInline(child.children);
        continue;
      }
      enforceEmittedAttributes(child, context);
      if (child.children) walkInline(child.children);
    }
  };

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type === "html_block") {
      fail(context, `raw HTML (${token.content.trim().split("\n")[0]}) is not part of the semantic fragment contract.`);
    }
    if (token.type === "heading_open") {
      if (token.tag === "h1") {
        fail(context, "fragments may not contain an h1 — the resource title lives in the manifest; start body headings at h2 (##).");
      }
      const id = token.attrGet("id") ?? "";
      if (!CANONICAL_HEADING_ID.test(id)) {
        fail(context, `heading id "${id}" is not canonical for the Docs artifact (lowercase a–z, digits, single hyphens) — provide an explicit {#ascii-id} override.`);
      }
      const inline = tokens[index + 1];
      headings.push({
        id,
        text: inline?.type === "inline" ? collectPlainText(inline.children) : "",
        level: Number(token.tag.slice(1)),
      });
    }
    if (token.type === "fence") {
      normalizeFenceLanguage(token.info, context);
      continue;
    }
    if (token.type === "th_open" || token.type === "td_open") {
      // markdown-it expresses column alignment as an inline style; alignment
      // is presentational and has no semantic-fragment representation.
      token.attrs = (token.attrs ?? []).filter(([name]) => name !== "style");
    }
    if (token.type === "inline") {
      walkInline(token.children);
      continue;
    }
    enforceEmittedAttributes(token, context);
  }

  return { html: md.renderer.render(tokens, md.options, {}), headings };
}
