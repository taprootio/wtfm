import { describe, it, expect } from "vitest";
import { propertiesRenderer } from "../src/server/section-renderers/properties.js";
import { interfaceDecl, variableDecl } from "./fixtures/type-fixtures.js";

describe("propertiesRenderer", () => {
  it("has the correct key and heading", () => {
    expect(propertiesRenderer.key).toBe("properties");
    expect(propertiesRenderer.heading).toBe("Properties");
  });

  it("renders interface members", async () => {
    const result = await propertiesRenderer.render(interfaceDecl, {});
    expect(result).toContain("## Properties");
    expect(result).toContain("`SchemeEvents` has the following properties:");
    expect(result).toContain("### seed-color-changed");
    expect(result).toContain("### scheme-changed");
    expect(result).toContain(
      "Fired when the effective seed color changes.",
    );
  });

  it("shows type info in post-description when member has both description and type", async () => {
    const result = await propertiesRenderer.render(interfaceDecl, {});
    expect(result).toContain(
      '`seed-color-changed` has a type of `{ seedColor: string; correlationId: string }`.',
    );
  });

  it("renders const object members", async () => {
    const result = await propertiesRenderer.render(variableDecl, {});
    expect(result).toContain("## Properties");
    expect(result).toContain("`ESP_EVENTS` has the following properties:");
    expect(result).toContain("### VALUE_CHANGED");
    expect(result).toContain("### CLICKED");
  });

  it("synthesizes description from type when member has no description", async () => {
    const result = await propertiesRenderer.render(variableDecl, {});
    // VALUE_CHANGED has no description, so it should show the type
    expect(result).toContain('Type: `"value-changed"`');
  });

  it("returns empty string when declaration has no members", async () => {
    const emptyDecl = {
      kind: "interface",
      name: "Empty",
      description: "Nothing here.",
      members: [],
    };
    const result = await propertiesRenderer.render(emptyDecl, {});
    expect(result).toBe("");
  });

  it("returns empty string when members is undefined", async () => {
    const noMembers = {
      kind: "interface",
      name: "Empty",
      description: "Nothing here.",
    };
    const result = await propertiesRenderer.render(noMembers, {});
    expect(result).toBe("");
  });

  it("only renders field members (not methods)", async () => {
    const mixed = {
      name: "Mixed",
      members: [
        {
          kind: "field",
          name: "myField",
          type: { text: "string" },
          description: "A field.",
          privacy: "public",
        },
        {
          kind: "method",
          name: "myMethod",
          description: "A method.",
          privacy: "public",
        },
      ],
    };
    const result = await propertiesRenderer.render(mixed, {});
    expect(result).toContain("### myField");
    expect(result).not.toContain("### myMethod");
  });
});
