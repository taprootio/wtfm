import markdownIt from "markdown-it";
import { configureMarkdownAnchors, contextualizeAnchorError } from "./anchors.js";
import { resolveDocumentUrl } from "./urls.js";

export const HELP_DOCUMENT_TAGS = Object.freeze([
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "em",
  "strong",
  "s",
  "code",
  "pre",
  "blockquote",
  "ul",
  "ol",
  "li",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "hr",
  "br",
  "a",
  "img",
]);

const HELP_TAG_SET = new Set(HELP_DOCUMENT_TAGS);
const HELP_ATTRIBUTES = Object.freeze({
  a: new Set(["href"]),
  img: new Set(["src", "alt"]),
  h1: new Set(["id"]),
  h2: new Set(["id"]),
  h3: new Set(["id"]),
  h4: new Set(["id"]),
  h5: new Set(["id"]),
  h6: new Set(["id"]),
});

function filterAttributes(token, allowed) {
  token.attrs = (token.attrs ?? []).filter(([name]) => allowed.has(name));
}

/**
 * Assert that rendered help output still conforms to the semantic ESP0119
 * keep-list. The renderer itself is constrained; this final check turns future
 * markdown-it rule changes into a build error instead of silent markup drift.
 *
 * @param {string} html
 * @returns {string}
 */
export function assertHelpDocumentMarkup(html) {
  const ids = new Set();
  const tagPattern = /<\/?([a-z][a-z\d]*)(\s[^<>]*?)?\s*\/?>/giu;
  let match;

  while ((match = tagPattern.exec(html)) !== null) {
    const tagName = match[1].toLowerCase();
    if (!HELP_TAG_SET.has(tagName)) {
      throw new Error(`wtfm: Help output contains disallowed <${tagName}> markup.`);
    }

    const attributes = match[2] ?? "";
    const allowed = HELP_ATTRIBUTES[tagName] ?? new Set();
    const attributePattern = /\s+([^\s=]+)="([^"]*)"/gu;
    let attributeMatch;
    let consumed = "";
    while ((attributeMatch = attributePattern.exec(attributes)) !== null) {
      const [, name, value] = attributeMatch;
      consumed += attributeMatch[0];
      if (!allowed.has(name)) {
        throw new Error(
          `wtfm: Help output contains disallowed "${name}" on <${tagName}>.`,
        );
      }
      if (name === "id") {
        if (ids.has(value)) {
          throw new Error(`wtfm: Help output anchor id "${value}" is not unique.`);
        }
        ids.add(value);
      }
    }

    if (consumed !== attributes) {
      throw new Error(
        `wtfm: Help output contains malformed or unsupported attributes on <${tagName}>.`,
      );
    }
  }

  return html;
}

/**
 * Render separately authored Markdown into the lean semantic document shape
 * consumed by Espalier help flyouts.
 *
 * @param {string} markdown
 * @param {object} [options]
 * @param {string} [options.documentUrl="/"] Route of the help document, used
 *   as the base for relative link and image URLs.
 * @param {string} [options.context] Human-readable document identity for
 *   anchor validation errors.
 * @returns {string}
 */
export function renderHelpDocument(markdown, options = {}) {
  const documentUrl = options.documentUrl || "/";
  const context = options.context || `help document at "${documentUrl}"`;
  const md = configureMarkdownAnchors(markdownIt({
    html: false,
    breaks: false,
    linkify: true,
  }));

  const defaultRenderToken = md.renderer.renderToken.bind(md.renderer);
  md.renderer.renderToken = (tokens, index, renderOptions) => {
    const token = tokens[index];
    const tagName = token.tag?.toLowerCase();
    const allowed = HELP_ATTRIBUTES[tagName] ?? new Set();
    filterAttributes(token, allowed);

    if (token.type === "link_open") {
      const href = token.attrGet("href");
      if (href !== null) token.attrSet("href", resolveDocumentUrl(href, documentUrl));
    }

    return defaultRenderToken(tokens, index, renderOptions);
  };

  const defaultImage = md.renderer.rules.image;
  md.renderer.rules.image = (tokens, index, renderOptions, env, renderer) => {
    const token = tokens[index];
    filterAttributes(token, HELP_ATTRIBUTES.img);
    const src = token.attrGet("src");
    if (src !== null) token.attrSet("src", resolveDocumentUrl(src, documentUrl));
    return defaultImage(tokens, index, renderOptions, env, renderer);
  };

  md.renderer.rules.fence = (tokens, index) =>
    `<pre><code>${md.utils.escapeHtml(tokens[index].content)}</code></pre>\n`;

  try {
    return assertHelpDocumentMarkup(md.render(String(markdown ?? "")));
  } catch (error) {
    throw contextualizeAnchorError(error, context);
  }
}
