import * as prettier from "prettier";
import { buildCemContext } from "./build-cem-context.js";
import { renderAnchoredHeading } from "../anchors.js";

/**
 * Section renderer that emits interactive `<wtfm-code-block>` elements
 * for each `@example` JSDoc block on a component.
 *
 * The examples array is populated by the WTFM CEM plugin
 * (`cem-plugin.js`), which extracts `@example` blocks from source
 * JSDoc comments and stores them as `decl.examples`. Each entry has
 * a `title` (text after `@example`) and a `body` (content, typically
 * a fenced ```html code block).
 *
 * Only renders when `decl.examples` is present. Components that embed
 * examples in their description (```html blocks) are already handled
 * by `renderDocs`' description processing — duplicating them here
 * would show the same demo twice.
 *
 * CEM metadata (attributes, events, slots) is serialised as a
 * `<script type="application/json">` child so the component can
 * build its playground without a runtime CEM fetch.
 */
export const examplesRenderer = {
  key: "examples",
  heading: "Examples",
  intro: "",

  async render(decl, options) {
    if (!decl.examples?.length) return "";

    const cemContext = buildCemContext(decl, options);
    return renderExampleBlocks(
      decl.examples,
      decl.tagName,
      this.heading,
      cemContext,
      options,
    );
  },
};

/**
 * Render multiple @example blocks, each as a titled code block.
 *
 * @param {Array<{title: string, body: string}>} examples
 * @param {string} tagName
 * @param {string} heading  Section heading (from the renderer instance).
 * @param {object} cemContext
 * @param {object} options
 * @returns {Promise<string>}
 */
async function renderExampleBlocks(examples, tagName, heading, cemContext, options = {}) {
  const blocks = [];
  const headingOffset = options.headingOffset ?? 0;

  for (const example of examples) {
    const htmlCode = extractHtmlFromBody(example.body);
    if (!htmlCode) continue;

    const formatted = await formatHtml(htmlCode);
    const encoded = Buffer.from(formatted).toString("base64");
    const title = example.title || "";

    let block = "";
    if (title) {
      block += `\n${renderAnchoredHeading(3 + headingOffset, title, {
        prefix: options.anchorPrefix,
        override: example.helpAnchor,
      })}\n\n`;
    }
    block += `<wtfm-code-block tag-name="${tagName}" source="${encoded}">
  <script type="application/json">${cemContext.cemJson}</script>
</wtfm-code-block>\n`;

    blocks.push(block);
  }

  if (blocks.length === 0) return "";

  return `\n${renderAnchoredHeading(2 + headingOffset, heading, {
    prefix: options.anchorPrefix,
  })}\n\n${blocks.join("\n")}`;
}

/**
 * Extract the HTML content from an @example body. Returns the content
 * of the first ```html fenced code block, or null if none is found.
 *
 * Unfenced bodies (plain text, non-HTML fenced blocks) are not treated
 * as HTML — they would produce confusing demos in `<wtfm-code-block>`.
 */
function extractHtmlFromBody(body) {
  const htmlIndex = body.indexOf("```html");
  if (htmlIndex < 0) return null;
  const codeStart = htmlIndex + 7;
  const codeEnd = body.indexOf("```", codeStart);
  if (codeEnd < 0) return body.substring(codeStart).trim() || null;
  return body.substring(codeStart, codeEnd).trim() || null;
}

/**
 * Format HTML with Prettier for consistent indentation.
 */
async function formatHtml(html) {
  try {
    const formatted = await prettier.format(html, {
      parser: "html",
      htmlWhitespaceSensitivity: "ignore",
    });
    return formatted.trim();
  } catch {
    return html.trim();
  }
}
