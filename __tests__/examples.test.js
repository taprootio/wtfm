import { describe, it, expect } from "vitest";
import { examplesRenderer } from "../src/server/section-renderers/examples.js";
import { minimalDecl } from "./fixtures/cem-fixtures.js";

describe("examplesRenderer", () => {
  it("has key 'examples'", () => {
    expect(examplesRenderer.key).toBe("examples");
  });

  it("has heading 'Examples'", () => {
    expect(examplesRenderer.heading).toBe("Examples");
  });

  // ── @example blocks ──────────────────────────────────────────────

  it("renders multiple @example blocks with titles", async () => {
    const decl = {
      ...minimalDecl,
      tagName: "test-el",
      examples: [
        {
          title: "Basic usage",
          body: "```html\n<test-el>Hello</test-el>\n```",
        },
        {
          title: "With attributes",
          body: '```html\n<test-el label="Hi"></test-el>\n```',
        },
      ],
    };

    const result = await examplesRenderer.render(decl, {});

    expect(result).toContain("## Examples");
    expect(result).toContain("### Basic usage");
    expect(result).toContain("### With attributes");
    expect(result).toContain("wtfm-code-block");
    expect(result).toContain('tag-name="test-el"');
  });

  it("renders @example without title (no h3)", async () => {
    const decl = {
      ...minimalDecl,
      tagName: "test-el",
      examples: [
        {
          title: "",
          body: "```html\n<test-el></test-el>\n```",
        },
      ],
    };

    const result = await examplesRenderer.render(decl, {});

    expect(result).toContain("## Examples");
    expect(result).not.toContain("### ");
    expect(result).toContain("wtfm-code-block");
  });

  it("skips examples with no extractable HTML", async () => {
    const decl = {
      ...minimalDecl,
      tagName: "test-el",
      examples: [
        {
          title: "Non-HTML example",
          body: "",
        },
      ],
    };

    const result = await examplesRenderer.render(decl, {});
    expect(result).toBe("");
  });

  it("encodes HTML source as base64 in the source attribute", async () => {
    const decl = {
      ...minimalDecl,
      tagName: "test-el",
      examples: [
        {
          title: "Encoded",
          body: "```html\n<test-el></test-el>\n```",
        },
      ],
    };

    const result = await examplesRenderer.render(decl, {});
    expect(result).toContain('source="');

    // Extract the base64 value and verify it decodes to the HTML
    const sourceMatch = result.match(/source="([^"]+)"/);
    expect(sourceMatch).toBeTruthy();
    const decoded = Buffer.from(sourceMatch[1], "base64").toString("utf-8");
    expect(decoded).toContain("<test-el>");
  });

  it("prefixes root-absolute URLs before encoding examples", async () => {
    const decl = {
      ...minimalDecl,
      tagName: "test-el",
      examples: [{
        title: "Asset",
        body: '```html\n<img src="/assets/demo.png">\n```',
      }],
    };

    const result = await examplesRenderer.render(decl, { pathPrefix: "/help/" });
    const sourceMatch = result.match(/source="([^"]+)"/);
    const decoded = Buffer.from(sourceMatch[1], "base64").toString("utf-8");
    expect(decoded).toContain('src="/help/assets/demo.png"');
  });

  // ── No examples ──────────────────────────────────────────────────

  it("returns empty string when declaration has no examples and no description", async () => {
    const decl = { ...minimalDecl, tagName: "test-el" };
    const result = await examplesRenderer.render(decl, {});
    expect(result).toBe("");
  });

  it("returns empty string when examples array is empty", async () => {
    const decl = { ...minimalDecl, tagName: "test-el", examples: [] };
    const result = await examplesRenderer.render(decl, {});
    expect(result).toBe("");
  });

  // ── No description fallback (avoids duplicate demos) ─────────────

  it("does not fall back to description html blocks (handled by renderDocs)", async () => {
    const decl = {
      ...minimalDecl,
      tagName: "test-el",
      description:
        "A test component.\n\n```html\n<test-el fallback></test-el>\n```",
    };

    const result = await examplesRenderer.render(decl, {});
    // Should return empty — description code blocks are rendered
    // inline by renderDocs, not duplicated here.
    expect(result).toBe("");
  });

  it("returns empty string when no examples and no description", async () => {
    const decl = {
      ...minimalDecl,
      tagName: "test-el",
      description: "A test component with no code blocks.",
    };

    const result = await examplesRenderer.render(decl, {});
    expect(result).toBe("");
  });

  // ── CEM context ──────────────────────────────────────────────────

  it("includes CEM JSON script for attribute playground", async () => {
    const decl = {
      ...minimalDecl,
      tagName: "test-el",
      attributes: [
        {
          name: "label",
          type: { text: "string" },
          default: '""',
          description: "The label",
        },
      ],
      examples: [
        {
          title: "With CEM",
          body: "```html\n<test-el></test-el>\n```",
        },
      ],
    };

    const result = await examplesRenderer.render(decl, {});
    expect(result).toContain('<script type="application/json">');
    expect(result).toContain('"label"');
  });
});
