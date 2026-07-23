import { describe, it, expect, vi } from "vitest";
import { eventsRenderer } from "../src/server/section-renderers/events.js";
import { fullDecl, minimalDecl } from "./fixtures/cem-fixtures.js";

describe("eventsRenderer", () => {
  it("has key 'events'", () => {
    expect(eventsRenderer.key).toBe("events");
  });

  it("returns empty string when declaration has no events", async () => {
    const result = await eventsRenderer.render(minimalDecl, {});
    expect(result).toBe("");
  });

  it("returns empty string when events array is empty", async () => {
    const decl = { ...minimalDecl, events: [] };
    const result = await eventsRenderer.render(decl, {});
    expect(result).toBe("");
  });

  it("renders the Events heading", async () => {
    const result = await eventsRenderer.render(fullDecl, {});
    expect(result).toContain("## Events");
  });

  it("interpolates {tagName} in intro", async () => {
    const result = await eventsRenderer.render(fullDecl, {});
    expect(result).toContain("`<test-element>` emits the following events:");
  });

  it("renders each event by name", async () => {
    const result = await eventsRenderer.render(fullDecl, {});
    expect(result).toContain("### opened");
    expect(result).toContain("### closed");
  });

  it("includes event type information", async () => {
    const result = await eventsRenderer.render(fullDecl, {});
    expect(result).toContain("`opened` is of type `CustomEvent`.");
    expect(result).toContain(
      "`closed` is of type `CustomEvent<{ reason: string }>`.",
    );
  });

  it("renders event descriptions", async () => {
    const result = await eventsRenderer.render(fullDecl, {});
    expect(result).toContain("Fires when the element opens.");
    expect(result).toContain("Fires when the element closes.");
  });

  it("omits unnamed events with an actionable warning", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const decl = {
      ...minimalDecl,
      tagName: "test-dialog",
      events: [
        { description: "First unnamed event.", type: { text: "Event" } },
        { description: "Second unnamed event.", type: { text: "Event" } },
      ],
    };

    await expect(eventsRenderer.render(decl, {})).resolves.toBe("");
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith(expect.objectContaining({
      message: "Unnamed event omitted from documentation",
      tagName: "test-dialog",
    }));
    warn.mockRestore();
  });
});
