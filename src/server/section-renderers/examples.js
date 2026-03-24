import * as prettier from "prettier";
import { buildCemContext } from "./build-cem-context.js";

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
 * Falls back to extracting the first ```html block from the
 * component's description for backward compatibility with components
 * that embed examples directly in their description instead of using
 * `@example` tags.
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
    const cemContext = buildCemContext(decl, options);

    // ── Try @example blocks first ───────────────────────────────
    if (decl.examples?.length) {
      return await renderExampleBlocks(decl.examples, decl.tagName, cemContext);
    }

    // ── Fallback: first ```html block from description ──────────
    return await renderDescriptionFallback(decl, cemContext);
  },
};

/**
 * Render multiple @example blocks, each as a titled code block.
 */
async function renderExampleBlocks(examples, tagName, cemContext) {
  const blocks = [];

  for (const example of examples) {
    const htmlCode = extractHtmlFromBody(example.body);
    if (!htmlCode) continue;

    const formatted = await formatHtml(htmlCode);
    const encoded = Buffer.from(formatted).toString("base64");
    const title = example.title || "";

    let block = "";
    if (title) {
      block += `\n### ${title}\n\n`;
    }
    block += `<wtfm-code-block tag-name="${tagName}" source="${encoded}">
  <script type="application/json">${cemContext.cemJson}</script>
</wtfm-code-block>\n`;

    blocks.push(block);
  }

  if (blocks.length === 0) return "";

  return `\n## ${examplesRenderer.heading}\n${blocks.join("\n")}`;
}

/**
 * Fallback: extract the first ```html block from the description.
 * This preserves backward compatibility with older components that
 * embed examples in the description rather than using @example tags.
 */
async function renderDescriptionFallback(decl, cemContext) {
  const desc = decl.description || "";
  const htmlIndex = desc.indexOf("```html");
  if (htmlIndex < 0) return "";

  const codeBlockEnd = desc.indexOf("```", htmlIndex + 7);
  if (codeBlockEnd < 0) return "";

  const rawHtml = desc.substring(htmlIndex + 7, codeBlockEnd).trim();
  const formatted = await formatHtml(rawHtml);
  const encoded = Buffer.from(formatted).toString("base64");

  return `
## ${examplesRenderer.heading}

<wtfm-code-block tag-name="${decl.tagName}" source="${encoded}">
  <script type="application/json">${cemContext.cemJson}</script>
</wtfm-code-block>
`;
}

/**
 * Extract the HTML content from an @example body. The body may be
 * a bare fenced code block (```html ... ```) or may contain the
 * code block among other text.
 */
function extractHtmlFromBody(body) {
  const htmlIndex = body.indexOf("```html");
  if (htmlIndex < 0) {
    // No fenced block — treat the whole body as HTML if non-empty.
    const trimmed = body.trim();
    return trimmed || null;
  }
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
