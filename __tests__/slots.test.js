import { describe, it, expect } from "vitest";
import { slotsRenderer } from "../src/server/section-renderers/slots.js";
import { fullDecl, minimalDecl } from "./fixtures/cem-fixtures.js";

describe("slotsRenderer", () => {
  it("has key 'slots'", () => {
    expect(slotsRenderer.key).toBe("slots");
  });

  it("returns empty string when declaration has no slots", async () => {
    const result = await slotsRenderer.render(minimalDecl, {});
    expect(result).toBe("");
  });

  it("returns empty string when slots array is empty", async () => {
    const decl = { ...minimalDecl, slots: [] };
    const result = await slotsRenderer.render(decl, {});
    expect(result).toBe("");
  });

  it("renders the Slots heading", async () => {
    const result = await slotsRenderer.render(fullDecl, {});
    expect(result).toContain("## Slots");
  });

  it("uses plural intro for multiple slots", async () => {
    const result = await slotsRenderer.render(fullDecl, {});
    expect(result).toContain("`<test-element>` has the following slots:");
  });

  it("uses singular intro for a single slot", async () => {
    const singleSlotDecl = {
      ...fullDecl,
      slots: [{ name: "content", description: "Main content." }],
    };
    const result = await slotsRenderer.render(singleSlotDecl, {});
    expect(result).toContain("`<test-element>` has a slot:");
  });

  it("renders each slot as a doc section", async () => {
    const result = await slotsRenderer.render(fullDecl, {});
    // Default slot should render with title "Default"
    expect(result).toContain("### Default");
    // Named slot should render with its name
    expect(result).toContain("### header");
  });

  it("renders slot descriptions", async () => {
    const result = await slotsRenderer.render(fullDecl, {});
    expect(result).toContain("The default content slot.");
    expect(result).toContain("Content for the header area.");
  });
});
