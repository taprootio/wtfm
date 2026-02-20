import { describe, it, expect } from "vitest";
import { buildCemContext } from "../src/server/section-renderers/build-cem-context.js";
import {
  fullDecl,
  minimalDecl,
  declWithExcludedAttrs,
  declWithScriptInDescription,
} from "./fixtures/cem-fixtures.js";

describe("buildCemContext", () => {
  it("returns the correct tagName", () => {
    const ctx = buildCemContext(fullDecl);
    expect(ctx.tagName).toBe("test-element");
  });

  it("returns parseable cemJson", () => {
    const ctx = buildCemContext(fullDecl);
    const parsed = JSON.parse(ctx.cemJson);
    expect(parsed).toHaveProperty("attributes");
    expect(parsed).toHaveProperty("events");
    expect(parsed).toHaveProperty("slots");
  });

  it("maps all attributes with name, type, and default", () => {
    const ctx = buildCemContext(fullDecl);
    const { attributes } = JSON.parse(ctx.cemJson);
    expect(attributes).toHaveLength(3);
    expect(attributes[0]).toEqual({
      name: "label",
      type: "string",
      default: '""',
    });
    expect(attributes[1]).toEqual({
      name: "disabled",
      type: "boolean",
      default: "false",
    });
  });

  it("maps events with name and type", () => {
    const ctx = buildCemContext(fullDecl);
    const { events } = JSON.parse(ctx.cemJson);
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ name: "opened", type: "CustomEvent" });
    expect(events[1]).toEqual({
      name: "closed",
      type: "CustomEvent<{ reason: string }>",
    });
  });

  it("maps slots with name and first-line description", () => {
    const ctx = buildCemContext(fullDecl);
    const { slots } = JSON.parse(ctx.cemJson);
    expect(slots).toHaveLength(2);
    expect(slots[0].name).toBe("");
    expect(slots[0].description).toBe("The default content slot.");
    expect(slots[1].name).toBe("header");
  });

  it("returns minimal output for a bare declaration", () => {
    const ctx = buildCemContext(minimalDecl);
    const parsed = JSON.parse(ctx.cemJson);
    expect(parsed.attributes).toEqual([]);
    expect(parsed.events).toEqual([]);
    expect(parsed.slots).toEqual([]);
  });

  it("filters excluded attributes", () => {
    const ctx = buildCemContext(declWithExcludedAttrs, {
      excludeAttributes: ["variant", "scheme"],
    });
    const { attributes } = JSON.parse(ctx.cemJson);
    expect(attributes).toHaveLength(1);
    expect(attributes[0].name).toBe("label");
  });

  it("honors attributeExceptions", () => {
    const ctx = buildCemContext(declWithExcludedAttrs, {
      excludeAttributes: ["variant", "scheme"],
      attributeExceptions: { scheme: ["esp-root"] },
    });
    const { attributes } = JSON.parse(ctx.cemJson);
    expect(attributes).toHaveLength(2);
    const names = attributes.map((a) => a.name);
    expect(names).toContain("label");
    expect(names).toContain("scheme");
    expect(names).not.toContain("variant");
  });

  it("defaults type to 'string' when type.text is missing", () => {
    const decl = {
      tagName: "x-el",
      attributes: [{ name: "foo" }],
    };
    const ctx = buildCemContext(decl);
    const { attributes } = JSON.parse(ctx.cemJson);
    expect(attributes[0].type).toBe("string");
  });

  it("escapes closing script tags so cemJson is safe inside <script>", () => {
    const ctx = buildCemContext(declWithScriptInDescription);
    // The raw string must not contain a literal </script> sequence
    expect(ctx.cemJson).not.toContain("</script>");
    expect(ctx.cemJson).not.toContain("</Script>");
  });

  it("cemJson with escaped closing tags is still valid JSON", () => {
    const ctx = buildCemContext(declWithScriptInDescription);
    const parsed = JSON.parse(ctx.cemJson);
    expect(parsed.slots[0].description).toContain("</script>");
    expect(parsed.attributes[0].default).toBe("false");
  });
});
