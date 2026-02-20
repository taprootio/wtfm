import * as prettier from "prettier";

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
 * @returns {Promise<string>} Formatted markdown string
 */
export async function buildDocSection(title, description, postDescription, cemContext = null) {
  if (!description) {
    console.warn({
      message: "No description",
      title,
      description,
    });
    return "";
  }

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

  let result = `
<div class="doc-section">

### ${title}

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
        result += `

<wtfm-code-block${tagAttr} source="${Buffer.from(part.v.trim()).toString("base64")}">${cemScript}
</wtfm-code-block>
`;
        break;
    }
  }

  return `${result}

</div>
`;
}
