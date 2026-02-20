import * as prettier from "prettier";

/**
 * Section renderer that extracts the first ```html code block from
 * a component's JSDoc description and emits a `<wtfm-code-block>`
 * element with live demo, syntax highlighting, an attribute
 * playground, and an event log.
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
    const { excludeAttributes = [], attributeExceptions = {} } = options;

    // ── Extract first ```html block from description ──────────
    const desc = decl.description || "";
    const htmlIndex = desc.indexOf("```html");
    if (htmlIndex < 0) return "";

    const codeBlockEnd = desc.indexOf("```", htmlIndex + 7);
    if (codeBlockEnd < 0) return "";

    const rawHtml = desc.substring(htmlIndex + 7, codeBlockEnd).trim();

    let formattedHtml;
    try {
      formattedHtml = await prettier.format(rawHtml, {
        parser: "html",
        htmlWhitespaceSensitivity: "ignore",
      });
    } catch {
      formattedHtml = rawHtml;
    }

    // ── Build CEM metadata ────────────────────────────────────
    const attrs = (decl.attributes ?? [])
      .filter((a) => {
        if (!excludeAttributes.includes(a.name)) return true;
        const exceptions = attributeExceptions[a.name];
        return exceptions && exceptions.includes(decl.tagName);
      })
      .map((a) => ({
        name: a.name,
        type: a.type?.text || "string",
        default: a.default,
      }));

    const events = (decl.events ?? []).map((e) => ({
      name: e.name,
      type: e.type?.text || "",
    }));

    const slots = (decl.slots ?? []).map((s) => ({
      name: s.name,
      description: (s.description || "").split("\n")[0],
    }));

    // Escape closing tags so the JSON is safe inside a <script> element.
    const cemJson = JSON.stringify({ attributes: attrs, events, slots }).replaceAll(
      "</",
      "<\\/",
    );

    // ── Emit the interactive code block ───────────────────────
    return `
## ${this.heading}

<wtfm-code-block tag-name="${decl.tagName}">
  <template>${formattedHtml.trim()}</template>
  <script type="application/json">${cemJson}</script>
</wtfm-code-block>
`;
  },
};
