import { describe, it, expect } from "vitest";
import { attributesRenderer } from "../src/server/section-renderers/attributes.js";
import {
  fullDecl,
  minimalDecl,
  declWithExcludedAttrs,
} from "./fixtures/cem-fixtures.js";

describe("attributesRenderer", () => {
  it("has key 'attributes'", () => {
    expect(attributesRenderer.key).toBe("attributes");
  });

  it("returns empty string when declaration has no attributes", async () => {
    const result = await attributesRenderer.render(minimalDecl, {});
    expect(result).toBe("");
  });

  it("returns empty string when attributes array is empty", async () => {
    const decl = { ...minimalDecl, attributes: [] };
    const result = await attributesRenderer.render(decl, {});
    expect(result).toBe("");
  });

  it("renders the Attributes heading", async () => {
    const result = await attributesRenderer.render(fullDecl, {});
    expect(result).toContain("## Attributes");
  });

  it("interpolates {tagName} in intro", async () => {
    const result = await attributesRenderer.render(fullDecl, {});
    expect(result).toContain("`<test-element>` has the following attributes:");
  });

  it("renders each attribute with its name", async () => {
    const result = await attributesRenderer.render(fullDecl, {});
    expect(result).toContain("### label");
    expect(result).toContain("### disabled");
    expect(result).toContain("### size");
  });

  it("includes default value text", async () => {
    const result = await attributesRenderer.render(fullDecl, {});
    expect(result).toContain('`label` has a default value of `""`.');
    expect(result).toContain("`disabled` has a default value of `false`.");
  });

  it("filters excluded attributes", async () => {
    const result = await attributesRenderer.render(declWithExcludedAttrs, {
      excludeAttributes: ["variant", "scheme"],
    });
    expect(result).toContain("### label");
    expect(result).not.toContain("### variant");
    expect(result).not.toContain("### scheme");
  });

  it("respects attributeExceptions", async () => {
    const result = await attributesRenderer.render(declWithExcludedAttrs, {
      excludeAttributes: ["variant", "scheme"],
      attributeExceptions: { scheme: ["esp-root"] },
    });
    expect(result).toContain("### label");
    expect(result).toContain("### scheme");
    expect(result).not.toContain("### variant");
  });

  it("returns empty when all attributes are excluded", async () => {
    const decl = {
      tagName: "my-el",
      attributes: [{ name: "variant", description: "Variant." }],
    };
    const result = await attributesRenderer.render(decl, {
      excludeAttributes: ["variant"],
    });
    expect(result).toBe("");
  });
});
