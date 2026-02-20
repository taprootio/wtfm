import { describe, it, expect } from "vitest";
import { createShikiTheme } from "../src/client/create-shiki-theme.js";
import type { ShikiColorTokens } from "../src/client/create-shiki-theme.js";

const hexColors: ShikiColorTokens = {
  background: "#1e1e1e",
  foreground: "#d4d4d4",
  comment: "#6a9955",
  string: "#ce9178",
  keyword: "#569cd6",
  function: "#dcdcaa",
  number: "#b5cea8",
  operator: "#d4d4d4",
  type: "#4ec9b0",
  tag: "#569cd6",
  attribute: "#9cdcfe",
  punctuation: "#d4d4d4",
  constant: "#4fc1ff",
};

describe("createShikiTheme", () => {
  it("returns a valid ThemeRegistration with correct metadata", () => {
    const theme = createShikiTheme("test-dark", "dark", hexColors);

    expect(theme.name).toBe("test-dark");
    expect(theme.displayName).toBe("test-dark");
    expect(theme.type).toBe("dark");
    expect(theme.bg).toBe("#1e1e1e");
    expect(theme.fg).toBe("#d4d4d4");
  });

  it("propagates light type correctly", () => {
    const theme = createShikiTheme("test-light", "light", hexColors);
    expect(theme.type).toBe("light");
  });

  it("sets editor colors", () => {
    const theme = createShikiTheme("test", "dark", hexColors);
    expect(theme.colors).toEqual({
      "editor.background": "#1e1e1e",
      "editor.foreground": "#d4d4d4",
    });
  });

  it("creates tokenColors for all scopes", () => {
    const theme = createShikiTheme("test", "dark", hexColors);
    const tokenColors = theme.tokenColors!;

    expect(tokenColors).toBeDefined();
    // Default foreground + 11 scoped entries = 12 total
    expect(tokenColors.length).toBe(12);
  });

  it("maps comment scope with italic style", () => {
    const theme = createShikiTheme("test", "dark", hexColors);
    const commentToken = theme.tokenColors!.find(
      (t) => t.scope === "comment",
    );
    expect(commentToken).toBeDefined();
    expect(commentToken!.settings.foreground).toBe("#6a9955");
    expect(commentToken!.settings.fontStyle).toBe("italic");
  });

  it("maps keyword scope including storage types", () => {
    const theme = createShikiTheme("test", "dark", hexColors);
    const keywordToken = theme.tokenColors!.find(
      (t) => Array.isArray(t.scope) && t.scope.includes("keyword"),
    );
    expect(keywordToken).toBeDefined();
    expect(keywordToken!.scope).toContain("storage.type");
    expect(keywordToken!.scope).toContain("storage.modifier");
    expect(keywordToken!.settings.foreground).toBe("#569cd6");
  });

  it("maps function scope", () => {
    const theme = createShikiTheme("test", "dark", hexColors);
    const fnToken = theme.tokenColors!.find(
      (t) =>
        Array.isArray(t.scope) &&
        t.scope.includes("entity.name.function"),
    );
    expect(fnToken).toBeDefined();
    expect(fnToken!.settings.foreground).toBe("#dcdcaa");
  });

  it("maps tag scope for HTML/XML", () => {
    const theme = createShikiTheme("test", "dark", hexColors);
    const tagToken = theme.tokenColors!.find(
      (t) => t.scope === "entity.name.tag",
    );
    expect(tagToken).toBeDefined();
    expect(tagToken!.settings.foreground).toBe("#569cd6");
  });

  it("converts oklch color values to hex", () => {
    const oklchColors: ShikiColorTokens = {
      ...hexColors,
      background: "oklch(0 0 0)",
      foreground: "oklch(1 0 0)",
    };
    const theme = createShikiTheme("oklch-test", "dark", oklchColors);
    expect(theme.bg).toBe("#000000");
    expect(theme.fg).toBe("#ffffff");
  });
});
