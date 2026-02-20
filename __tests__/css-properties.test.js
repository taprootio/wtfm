import { describe, it, expect } from "vitest";
import { cssPropertiesRenderer } from "../src/server/section-renderers/css-properties.js";
import { fullDecl, minimalDecl } from "./fixtures/cem-fixtures.js";

describe("cssPropertiesRenderer", () => {
  it("has key 'css-properties'", () => {
    expect(cssPropertiesRenderer.key).toBe("css-properties");
  });

  it("returns empty string when declaration has no cssProperties", async () => {
    const result = await cssPropertiesRenderer.render(minimalDecl, {});
    expect(result).toBe("");
  });

  it("returns empty string when cssProperties array is empty", async () => {
    const decl = { ...minimalDecl, cssProperties: [] };
    const result = await cssPropertiesRenderer.render(decl, {});
    expect(result).toBe("");
  });

  it("renders the CSS Properties heading", async () => {
    const result = await cssPropertiesRenderer.render(fullDecl, {});
    expect(result).toContain("## CSS Properties");
  });

  it("interpolates {tagName} in intro", async () => {
    const result = await cssPropertiesRenderer.render(fullDecl, {});
    expect(result).toContain(
      "`<test-element>` has the following CSS properties:",
    );
  });

  it("renders each property by name", async () => {
    const result = await cssPropertiesRenderer.render(fullDecl, {});
    expect(result).toContain("### --test-bg");
    expect(result).toContain("### --test-fg");
  });

  it("renders property descriptions", async () => {
    const result = await cssPropertiesRenderer.render(fullDecl, {});
    expect(result).toContain("Background color of the element.");
    expect(result).toContain("Foreground (text) color.");
  });
});
