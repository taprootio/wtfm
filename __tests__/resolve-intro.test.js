import { describe, it, expect } from "vitest";
import { resolveIntro } from "../src/server/section-renderers/resolve-intro.js";

describe("resolveIntro", () => {
  it("interpolates {tagName} in a string template", () => {
    const result = resolveIntro(
      "`<{tagName}>` has the following attributes:",
      "my-element",
      3,
    );
    expect(result).toBe("`<my-element>` has the following attributes:");
  });

  it("replaces multiple {tagName} occurrences", () => {
    const result = resolveIntro(
      "{tagName} is great. Use {tagName} everywhere!",
      "cool-widget",
      1,
    );
    expect(result).toBe(
      "cool-widget is great. Use cool-widget everywhere!",
    );
  });

  it("calls a function form with tagName and count", () => {
    const intro = ({ tagName, count }) =>
      count > 1
        ? `\`<${tagName}>\` has ${count} slots:`
        : `\`<${tagName}>\` has a slot:`;

    expect(resolveIntro(intro, "my-el", 3)).toBe(
      "`<my-el>` has 3 slots:",
    );
    expect(resolveIntro(intro, "my-el", 1)).toBe(
      "`<my-el>` has a slot:",
    );
  });

  it("handles count of 0 in function form", () => {
    const intro = ({ count }) => `Found ${count} items.`;
    expect(resolveIntro(intro, "x", 0)).toBe("Found 0 items.");
  });

  it("returns original string when no {tagName} placeholder exists", () => {
    const result = resolveIntro("No placeholder here.", "my-el", 5);
    expect(result).toBe("No placeholder here.");
  });

  it("interpolates {name} in a string template", () => {
    const result = resolveIntro(
      "`{name}` has the following properties:",
      "SchemeEvents",
      2,
    );
    expect(result).toBe(
      "`SchemeEvents` has the following properties:",
    );
  });

  it("passes name alongside tagName in function form", () => {
    const intro = ({ name, tagName, count }) => {
      expect(name).toBe(tagName);
      return `${name} has ${count} items.`;
    };
    const result = resolveIntro(intro, "EspBus", 3);
    expect(result).toBe("EspBus has 3 items.");
  });

  it("handles templates with both {tagName} and {name} placeholders", () => {
    const result = resolveIntro(
      "{name} (aka {tagName})",
      "MyType",
      1,
    );
    expect(result).toBe("MyType (aka MyType)");
  });
});
