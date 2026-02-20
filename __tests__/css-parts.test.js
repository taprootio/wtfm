import { describe, it, expect } from "vitest";
import { cssPartsRenderer } from "../src/server/section-renderers/css-parts.js";
import { fullDecl, minimalDecl } from "./fixtures/cem-fixtures.js";

describe("cssPartsRenderer", () => {
  it("has key 'css-parts'", () => {
    expect(cssPartsRenderer.key).toBe("css-parts");
  });

  it("returns empty string when declaration has no cssParts", async () => {
    const result = await cssPartsRenderer.render(minimalDecl, {});
    expect(result).toBe("");
  });

  it("returns empty string when cssParts array is empty", async () => {
    const decl = { ...minimalDecl, cssParts: [] };
    const result = await cssPartsRenderer.render(decl, {});
    expect(result).toBe("");
  });

  it("renders the CSS Parts heading", async () => {
    const result = await cssPartsRenderer.render(fullDecl, {});
    expect(result).toContain("## CSS Parts");
  });

  it("uses plural intro for multiple parts", async () => {
    const result = await cssPartsRenderer.render(fullDecl, {});
    expect(result).toContain(
      "`<test-element>` has the following CSS parts:",
    );
  });

  it("uses singular intro for a single part", async () => {
    const singlePartDecl = {
      ...fullDecl,
      cssParts: [{ name: "wrapper", description: "The wrapper." }],
    };
    const result = await cssPartsRenderer.render(singlePartDecl, {});
    expect(result).toContain("`<test-element>` has a CSS part:");
  });

  it("renders each part by name", async () => {
    const result = await cssPartsRenderer.render(fullDecl, {});
    expect(result).toContain("### container");
    expect(result).toContain("### label");
  });

  it("renders part descriptions", async () => {
    const result = await cssPartsRenderer.render(fullDecl, {});
    expect(result).toContain("The outer container element.");
    expect(result).toContain("The label text element.");
  });
});
