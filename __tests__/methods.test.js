import { describe, it, expect } from "vitest";
import { methodsRenderer } from "../src/server/section-renderers/methods.js";
import { fullDecl, minimalDecl } from "./fixtures/cem-fixtures.js";

describe("methodsRenderer", () => {
  it("has key 'methods'", () => {
    expect(methodsRenderer.key).toBe("methods");
  });

  it("returns empty string when declaration has no members", async () => {
    const result = await methodsRenderer.render(minimalDecl, {});
    expect(result).toBe("");
  });

  it("returns empty string when members array is empty", async () => {
    const decl = { ...minimalDecl, members: [] };
    const result = await methodsRenderer.render(decl, {});
    expect(result).toBe("");
  });

  it("renders the Methods heading", async () => {
    const result = await methodsRenderer.render(fullDecl, {});
    expect(result).toContain("## Methods");
  });

  it("renders only public methods, not private ones", async () => {
    const result = await methodsRenderer.render(fullDecl, {});
    expect(result).toContain("### toggleOpen");
    expect(result).toContain("### close");
    expect(result).not.toContain("### _internalSetup");
  });

  it("excludes fields (non-method members)", async () => {
    const result = await methodsRenderer.render(fullDecl, {});
    expect(result).not.toContain("### isOpen");
  });

  it("returns empty when only private methods exist", async () => {
    const decl = {
      ...minimalDecl,
      members: [
        {
          kind: "method",
          name: "_setup",
          privacy: "private",
          description: "Private method.",
        },
      ],
    };
    const result = await methodsRenderer.render(decl, {});
    expect(result).toBe("");
  });

  it("interpolates {tagName} in intro", async () => {
    const result = await methodsRenderer.render(fullDecl, {});
    expect(result).toContain("`<test-element>` has the following methods:");
  });
});
