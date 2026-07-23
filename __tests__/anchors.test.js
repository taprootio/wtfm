import { describe, expect, it } from "vitest";
import markdownIt from "markdown-it";
import {
  configureMarkdownAnchors,
  renderAnchoredHeading,
  resolveAnchorId,
  slugifyAnchor,
  validateAnchorId,
} from "../src/server/anchors.js";
import { buildDocSection } from "../src/server/section-renderers/build-doc-section.js";

describe("stable anchors", () => {
  it("uses a documented lowercase kebab-case slug", () => {
    expect(slugifyAnchor("  Café & CSS Properties  ")).toBe(
      "cafe-css-properties",
    );
    expect(slugifyAnchor("What's New?")).toBe("whats-new");
  });

  it("namespaces generated ids for composed surfaces", () => {
    expect(resolveAnchorId("Attributes", { prefix: "test-widget" })).toBe(
      "test-widget--attributes",
    );
  });

  it("preserves section hierarchy in multi-part prefixes", () => {
    expect(
      resolveAnchorId("icon", { prefix: ["esp-badge", "attributes"] }),
    ).toBe("esp-badge--attributes--icon");
    expect(resolveAnchorId("icon", { prefix: [undefined, "slots"] })).toBe(
      "slots--icon",
    );
  });

  it("preserves an explicit override exactly and does not namespace it", () => {
    expect(
      resolveAnchorId("Display title", {
        prefix: "test-widget",
        override: { name: "FieldName", description: "" },
      }),
    ).toBe("FieldName");
  });

  it("rejects empty or whitespace-containing explicit ids", () => {
    expect(() => validateAnchorId(" ")).toThrow(/Invalid anchor id/);
    expect(() => validateAnchorId("not valid")).toThrow(/no whitespace/);
  });

  it("renders generated headings with explicit stable ids", () => {
    expect(renderAnchoredHeading(2, "CSS Properties")).toBe(
      "## CSS Properties {#css-properties}",
    );
  });

  it("adds ids to authored Markdown without extra heading attributes", () => {
    const md = configureMarkdownAnchors(markdownIt());
    expect(md.render("## General help")).toBe(
      '<h2 id="general-help">General help</h2>\n',
    );
    expect(md.render("## Title {#Title}")).toBe(
      '<h2 id="Title">Title</h2>\n',
    );
  });

  it("allows only explicit id attributes from Markdown", () => {
    const md = configureMarkdownAnchors(markdownIt());
    expect(md.render("## Title {#Title .unsafe data-x=value}")).toBe(
      '<h2 id="Title">Title</h2>\n',
    );
  });

  it("fails instead of renumbering duplicate generated ids", () => {
    const md = configureMarkdownAnchors(markdownIt());
    expect(() => md.render("## Same\n\n## Same")).toThrow(
      /Duplicate generated anchor id "same"/,
    );
  });

  it("fails for duplicate explicit ids", () => {
    const md = configureMarkdownAnchors(markdownIt());
    expect(() => md.render("## One {#Pinned}\n\n## Two {#Pinned}")).toThrow(
      /id.*Pinned.*not unique/i,
    );
  });

  it("passes namespace and @helpAnchor through generated item headings", async () => {
    const generated = await buildDocSection(
      "Visible name",
      "Description.",
      "",
      null,
      { prefix: "test-widget" },
    );
    expect(generated).toContain(
      "### Visible name {#test-widget--visible-name}",
    );

    const overridden = await buildDocSection(
      "Visible name",
      "Description.",
      "",
      null,
      { prefix: "test-widget", override: { name: "FieldName" } },
    );
    expect(overridden).toContain("### Visible name {#FieldName}");
  });
});
