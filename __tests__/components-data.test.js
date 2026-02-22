import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import createComponentsData from "../src/server/data/components.js";

vi.mock("fs", () => ({
  readFileSync: vi.fn(),
}));

/** A minimal CEM for testing. */
const fakeCem = {
  modules: [
    {
      declarations: [
        {
          name: "EspButton",
          tagName: "esp-button",
          description:
            "A button component. It supports multiple variants and sizes.",
          docUrl: { name: "/components/button" },
          menuLabel: { name: "Button" },
          menuIcon: { name: "button-icon" },
          docPageTitle: { name: "Button" },
        },
      ],
    },
    {
      declarations: [
        {
          name: "EspCheckbox",
          tagName: "esp-checkbox",
          description:
            "A [checkbox](https://example.com) for `boolean` input. Supports indeterminate state.",
          docUrl: { name: "/components/checkbox" },
          menuLabel: { name: "Checkbox" },
          docPageTitle: { name: "Checkbox" },
        },
      ],
    },
    {
      declarations: [
        {
          name: "EspCheckboxGroup",
          tagName: "esp-checkbox-group",
          description: "Groups multiple checkboxes together.",
          docUrl: { name: "/components/checkbox", description: "group" },
          docPageTitle: { name: "Checkbox", description: "Group" },
        },
      ],
    },
    {
      // No docUrl — should be excluded
      declarations: [
        {
          name: "InternalHelper",
          tagName: "internal-helper",
          description: "Not publicly documented.",
        },
      ],
    },
    {
      // Component class is NOT the first declaration (e.g. helper
      // function exported before the class).
      declarations: [
        {
          name: "resetCache",
          kind: "function",
          description: "Resets the font cache.",
        },
        {
          name: "EspFontPicker",
          tagName: "esp-font-picker",
          description: "A font picker component.",
          docUrl: { name: "/components/font-picker" },
          menuLabel: { name: "Font", description: "Picker" },
          menuIcon: { name: "typography" },
          docPageTitle: { name: "Font", description: "Picker" },
        },
      ],
    },
  ],
};

describe("createComponentsData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a function", () => {
    const fn = createComponentsData({ cemPath: "/fake/path.json" });
    expect(typeof fn).toBe("function");
  });

  it("reads and parses the CEM file", () => {
    readFileSync.mockReturnValue(JSON.stringify(fakeCem));
    const fn = createComponentsData({ cemPath: "/fake/cem.json" });
    fn();
    expect(readFileSync).toHaveBeenCalledWith("/fake/cem.json", "utf-8");
  });

  it("returns empty array when CEM file is missing", () => {
    readFileSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });
    const fn = createComponentsData({ cemPath: "/missing.json" });
    expect(fn()).toEqual([]);
  });

  it("excludes declarations without @docUrl", () => {
    readFileSync.mockReturnValue(JSON.stringify(fakeCem));
    const fn = createComponentsData({ cemPath: "/fake.json" });
    const result = fn();
    const tagNames = result.map((c) => c.tagName);
    expect(tagNames).not.toContain("internal-helper");
  });

  it("includes declarations with @docUrl", () => {
    readFileSync.mockReturnValue(JSON.stringify(fakeCem));
    const fn = createComponentsData({ cemPath: "/fake.json" });
    const result = fn();
    expect(result.length).toBe(4);
    const tagNames = result.map((c) => c.tagName);
    expect(tagNames).toContain("esp-button");
    expect(tagNames).toContain("esp-checkbox");
    expect(tagNames).toContain("esp-checkbox-group");
    expect(tagNames).toContain("esp-font-picker");
  });

  it("combines split tag values for URL", () => {
    readFileSync.mockReturnValue(JSON.stringify(fakeCem));
    const fn = createComponentsData({ cemPath: "/fake.json" });
    const result = fn();
    const group = result.find((c) => c.tagName === "esp-checkbox-group");
    expect(group.url).toBe("/components/checkbox group");
  });

  it("extracts first sentence for metaDescription, stripping markdown", () => {
    readFileSync.mockReturnValue(JSON.stringify(fakeCem));
    const fn = createComponentsData({ cemPath: "/fake.json" });
    const result = fn();
    const checkbox = result.find((c) => c.tagName === "esp-checkbox");
    // Should strip [link](url) and backticks
    expect(checkbox.metaDescription).toBe(
      "A checkbox for boolean input.",
    );
  });

  it("sorts results alphabetically by URL", () => {
    readFileSync.mockReturnValue(JSON.stringify(fakeCem));
    const fn = createComponentsData({ cemPath: "/fake.json" });
    const result = fn();
    const urls = result.map((c) => c.url);
    const sorted = [...urls].sort();
    expect(urls).toEqual(sorted);
  });

  it("finds the component class even when it is not the first declaration", () => {
    readFileSync.mockReturnValue(JSON.stringify(fakeCem));
    const fn = createComponentsData({ cemPath: "/fake.json" });
    const result = fn();
    const fontPicker = result.find((c) => c.tagName === "esp-font-picker");
    expect(fontPicker).toBeDefined();
    expect(fontPicker.className).toBe("EspFontPicker");
    expect(fontPicker.url).toBe("/components/font-picker");
    expect(fontPicker.menuLabel).toBe("Font Picker");
    expect(fontPicker.pageTitle).toBe("Font Picker");
  });

  it("builds breadcrumbs with Components root", () => {
    readFileSync.mockReturnValue(JSON.stringify(fakeCem));
    const fn = createComponentsData({ cemPath: "/fake.json" });
    const result = fn();
    const button = result.find((c) => c.tagName === "esp-button");
    expect(button.crumbs[0]).toEqual({
      label: "Components",
      url: "/components",
    });
    expect(button.crumbs[1].label).toBe("Button");
  });
});
