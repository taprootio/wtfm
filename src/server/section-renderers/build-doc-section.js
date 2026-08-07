import * as prettier from "prettier";
import { renderAnchoredHeading } from "../anchors.js";
import { applyPathPrefixToHtml } from "../urls.js";

/**
 * Builds a CEM metadata JSON string for embedding in a
 * `<wtfm-code-block>` element.  Returns an empty string
 * when no `cemContext` is provided.
 *
 * @param {object|null} cemContext
 * @param {string} cemContext.tagName - The custom element tag name
 * @param {string} cemContext.cemJson - Pre-serialised CEM JSON string
 * @returns {string}
 */
function buildCemScript(cemContext) {
  if (!cemContext) return "";
  return `\n  <script type="application/json">${cemContext.cemJson}</script>`;
}

/**
 * Formats a single documentation item with title, description, and
 * optional post-description. Parses ```html code blocks from the
 * description and formats them with Prettier.
 *
 * @param {string} title - The H3 heading for this item
 * @param {string} description - Markdown description, may contain ```html blocks
 * @param {string} postDescription - Additional text shown after the title
 * @param {object|null} [cemContext] - Optional CEM metadata for interactive code blocks
 * @param {string} cemContext.tagName - The custom element tag name
 * @param {string} cemContext.cemJson - Pre-serialised CEM JSON string
 * @param {object} [anchorOptions] - Stable heading anchor options
 * @param {string} [anchorOptions.prefix] - Namespace for generated ids
 * @param {object|string} [anchorOptions.override] - Exact @helpAnchor value
 * @param {number} [anchorOptions.level=3] - Heading level for this item
 * @param {string} [anchorOptions.pathPrefix="/"] - Deployment prefix for demo URLs
 * @returns {Promise<string>} Formatted markdown string
 */
export async function buildDocSection(
  title,
  description,
  postDescription,
  cemContext = null,
  anchorOptions = {},
) {
  if (!description) {
    console.warn({
      message: "No description",
      title,
      description,
    });
    return "";
  }

  const {
    level = 3,
    pathPrefix = cemContext?.pathPrefix || "/",
    semantic = false,
    ...resolvedAnchorOptions
  } = anchorOptions;
  const descriptionParts = [];

  let htmlIndex = description.indexOf("```html");

  if (htmlIndex < 0) {
    descriptionParts.push({ t: "text", v: description });
  }

  while (htmlIndex >= 0) {
    // NOTE: Get everything up to the code block...
    const desc = description
      .substring(0, htmlIndex === -1 ? description.length : htmlIndex)
      .trim();
    descriptionParts.push({ t: "text", v: desc });

    const codeBlockEnd = description.indexOf("```", htmlIndex + 7);

    const html = description.substring(htmlIndex + 7, codeBlockEnd).trim();
    description = description.substring(codeBlockEnd + 3);

    const formattedHtml = await prettier.format(html, {
      parser: "html",
      htmlWhitespaceSensitivity: "ignore",
    });

    descriptionParts.push({ t: "code", v: formattedHtml });
    htmlIndex = description.indexOf("```html");
  }

  const desc = descriptionParts[0].v;

  if (semantic) {
    return buildSemanticSection(title, descriptionParts, postDescription, {
      ...resolvedAnchorOptions,
      level,
    });
  }

  let result = `
<div class="doc-section">

${renderAnchoredHeading(level, title, resolvedAnchorOptions)}

${postDescription}

${desc}

`;

  const tagAttr = cemContext ? ` tag-name="${cemContext.tagName}"` : "";
  const cemScript = buildCemScript(cemContext);

  for (let i = 1; i < descriptionParts.length; i++) {
    const part = descriptionParts[i];

    switch (part.t) {
      case "text":
        result += `

${part.v}
`;
        break;
      case "code":
        // Encode the HTML as base64 so markdown-it cannot
        // corrupt content inside <script> or <style> blocks
        // (e.g. indented JS being treated as a code fence).
        const prefixedHtml = await applyPathPrefixToHtml(part.v.trim(), pathPrefix);
        result += `

<wtfm-code-block${tagAttr} source="${Buffer.from(prefixedHtml).toString("base64")}">${cemScript}
</wtfm-code-block>
`;
        break;
    }
  }

  return `${result}

</div>
`;
}

/**
 * Render a fenced code block whose delimiter is guaranteed not to collide
 * with backtick runs inside the content.
 *
 * @param {string} content
 * @param {string} language
 * @returns {string}
 */
export function renderSemanticFence(content, language) {
  const longestRun = content.match(/`+/gu)?.reduce(
    (max, run) => Math.max(max, run.length),
    0,
  ) ?? 0;
  const fence = "`".repeat(Math.max(3, longestRun + 1));
  return `${fence}${language}\n${content}\n${fence}`;
}

/**
 * The Taproot Docs variant of a documentation section: pure Markdown limited
 * to the artifact contract's semantic set. No `div` wrapper, no interactive
 * `<wtfm-code-block>` — demo HTML becomes a plain fenced code block, and the
 * deployment path prefix is deliberately not applied because fragments must
 * stay host-independent.
 */
function buildSemanticSection(title, descriptionParts, postDescription, anchorOptions) {
  const { level, ...resolvedAnchorOptions } = anchorOptions;
  let result = `\n${renderAnchoredHeading(level, title, resolvedAnchorOptions)}\n`;
  if (postDescription) result += `\n${postDescription}\n`;

  for (const part of descriptionParts) {
    if (part.t === "text") {
      if (part.v) result += `\n${part.v}\n`;
    } else {
      result += `\n${renderSemanticFence(part.v.trim(), "html")}\n`;
    }
  }
  return `${result}\n`;
}
