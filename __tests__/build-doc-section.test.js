import { describe, it, expect } from "vitest";
import { buildDocSection } from "../src/server/section-renderers/build-doc-section.js";

describe("buildDocSection", () => {
  it("renders a simple markdown section with title and description", async () => {
    const result = await buildDocSection(
      "label",
      "The visible label text.",
      "`label` has a default value of `\"\"`.",
    );
    expect(result).toContain("### label");
    expect(result).toContain("The visible label text.");
    expect(result).toContain('`label` has a default value of `""`.');
    expect(result).toContain('<div class="doc-section">');
    expect(result).toContain("</div>");
  });

  it("returns empty string when description is falsy", async () => {
    const result = await buildDocSection("test", "", "post");
    expect(result).toBe("");
  });

  it("returns empty string when description is undefined", async () => {
    const result = await buildDocSection("test", undefined, "post");
    expect(result).toBe("");
  });

  it("converts ```html blocks to <wtfm-code-block> with base64 source attribute", async () => {
    const desc = 'Some text.\n\n```html\n<my-el label="Hi"></my-el>\n```\n\nMore text.';
    const result = await buildDocSection("demo", desc, "");
    expect(result).toContain("<wtfm-code-block");
    expect(result).toContain("</wtfm-code-block>");
    // Should use base64-encoded source attribute, NOT raw <template>
    expect(result).toMatch(/source="[A-Za-z0-9+/=]+"/);
    expect(result).not.toContain("<template>");
    // The original fenced code should NOT appear
    expect(result).not.toContain("```html");
  });

  it("base64 source attribute decodes to the original HTML", async () => {
    const desc = '```html\n<my-el label="Hi"></my-el>\n```';
    const result = await buildDocSection("demo", desc, "");
    const match = result.match(/source="([A-Za-z0-9+/=]+)"/);
    expect(match).not.toBeNull();
    const decoded = Buffer.from(match[1], "base64").toString();
    expect(decoded).toContain("<my-el");
    expect(decoded).toContain('label="Hi"');
  });

  it("handles multiple ```html blocks", async () => {
    const desc =
      'Text.\n\n```html\n<a></a>\n```\n\nMiddle.\n\n```html\n<b></b>\n```';
    const result = await buildDocSection("multi", desc, "");
    const codeBlockCount = (result.match(/<wtfm-code-block/g) || [])
      .length;
    expect(codeBlockCount).toBe(2);
  });

  it("injects tag-name attribute and CEM JSON when cemContext is provided", async () => {
    const cemContext = {
      tagName: "my-widget",
      cemJson: '{"attributes":[],"events":[],"slots":[]}',
    };
    const desc = '```html\n<my-widget></my-widget>\n```';
    const result = await buildDocSection("demo", desc, "", cemContext);
    expect(result).toContain('tag-name="my-widget"');
    expect(result).toContain('<script type="application/json">');
    expect(result).toContain(cemContext.cemJson);
  });

  it("omits tag-name and CEM JSON when cemContext is null", async () => {
    const desc = '```html\n<div>hello</div>\n```';
    const result = await buildDocSection("demo", desc, "");
    expect(result).not.toContain("tag-name=");
    expect(result).not.toContain('<script type="application/json">');
  });

  it("formats HTML with Prettier before encoding", async () => {
    const desc = '```html\n<div><span>hello</span></div>\n```';
    const result = await buildDocSection("fmt", desc, "");
    const match = result.match(/source="([A-Za-z0-9+/=]+)"/);
    expect(match).not.toBeNull();
    const decoded = Buffer.from(match[1], "base64").toString();
    // Prettier should format the HTML (e.g. break onto separate lines)
    expect(decoded).toContain("<div>");
    expect(decoded).toContain("<span>");
  });

  it("preserves <script> content inside HTML code blocks", async () => {
    const scriptContent = `<div id="app"></div>
<script>
  const el = findByTagName("div")[0];
  if (el) {
    el.textContent = "Hello";
  }
</script>`;
    const desc = '```html\n' + scriptContent + '\n```';
    const result = await buildDocSection("script-demo", desc, "");
    const match = result.match(/source="([A-Za-z0-9+/=]+)"/);
    expect(match).not.toBeNull();
    const decoded = Buffer.from(match[1], "base64").toString();
    // The script content should survive intact — no markdown corruption
    expect(decoded).toContain("if (el)");
    expect(decoded).toContain("findByTagName");
    expect(decoded).not.toContain("<pre>");
    expect(decoded).not.toContain("<code>");
    expect(decoded).not.toContain("&quot;");
  });

  it("preserves <style> content inside HTML code blocks", async () => {
    const styleContent = `<style>
  .card::part(box) {
    display: grid;
    padding: 0;
  }
</style>
<my-card class="card">Content</my-card>`;
    const desc = '```html\n' + styleContent + '\n```';
    const result = await buildDocSection("style-demo", desc, "");
    const match = result.match(/source="([A-Za-z0-9+/=]+)"/);
    expect(match).not.toBeNull();
    const decoded = Buffer.from(match[1], "base64").toString();
    expect(decoded).toContain("<style>");
    expect(decoded).toContain("display: grid");
    expect(decoded).toContain("</style>");
  });
});
