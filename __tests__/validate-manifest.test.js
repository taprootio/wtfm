import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { validateManifest } from "../src/server/validate-manifest.js";

vi.mock("fs", () => ({
  readFileSync: vi.fn(),
}));

/** A valid CEM where every custom element has all required tags. */
const validCem = {
  modules: [
    {
      declarations: [
        {
          name: "EspButton",
          tagName: "esp-button",
          docUrl: { name: "/components/button" },
          docPageTitle: { name: "Button" },
          menuLabel: { name: "Button" },
          menuGroup: { name: "Form Controls" },
          menuIcon: { name: "button-icon" },
        },
      ],
    },
    {
      declarations: [
        {
          name: "EspCheckbox",
          tagName: "esp-checkbox",
          docUrl: { name: "/components/checkbox" },
          docPageTitle: { name: "Checkbox" },
          menuLabel: { name: "Checkbox" },
          menuGroup: { name: "Form Controls" },
          menuIcon: { name: "checkbox-icon" },
        },
      ],
    },
  ],
};

/** A CEM with one element missing a required tag (menuGroup). */
const missingTagsCem = {
  modules: [
    {
      declarations: [
        {
          name: "EspButton",
          tagName: "esp-button",
          docUrl: { name: "/components/button" },
          docPageTitle: { name: "Button" },
          // Missing menuGroup (required by default)
        },
      ],
    },
  ],
};

/** A CEM with a mix of custom elements and non-element declarations. */
const mixedCem = {
  modules: [
    {
      declarations: [
        {
          name: "resetCache",
          kind: "function",
          description: "Resets the font cache.",
          // No tagName — not a custom element
        },
        {
          name: "EspFontPicker",
          tagName: "esp-font-picker",
          docUrl: { name: "/components/font-picker" },
          docPageTitle: { name: "Font Picker" },
          menuLabel: { name: "Font Picker" },
          menuGroup: { name: "Form Controls" },
          menuIcon: { name: "typography" },
        },
      ],
    },
  ],
};

describe("validateManifest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes when all custom elements have required tags", () => {
    readFileSync.mockReturnValue(JSON.stringify(validCem));
    const result = validateManifest("/fake/cem.json");
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("fails with descriptive errors when tags are missing", () => {
    readFileSync.mockReturnValue(JSON.stringify(missingTagsCem));
    const result = validateManifest("/fake/cem.json");
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("<esp-button>");
    expect(result.errors[0]).toContain("@menuGroup");
  });

  it("skips elements listed in skipTags", () => {
    readFileSync.mockReturnValue(JSON.stringify(missingTagsCem));
    const result = validateManifest("/fake/cem.json", {
      skipTags: ["esp-button"],
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("ignores non-custom-element declarations", () => {
    readFileSync.mockReturnValue(JSON.stringify(mixedCem));
    const result = validateManifest("/fake/cem.json");
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("returns error when CEM file cannot be read", () => {
    readFileSync.mockImplementation(() => {
      throw new Error("ENOENT: no such file");
    });
    const result = validateManifest("/missing/cem.json");
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("Failed to read CEM");
    expect(result.errors[0]).toContain("ENOENT");
  });

  it("accepts custom required tags", () => {
    const cem = {
      modules: [
        {
          declarations: [
            {
              name: "EspWidget",
              tagName: "esp-widget",
              docUrl: { name: "/components/widget" },
              // Missing customTag
            },
          ],
        },
      ],
    };
    readFileSync.mockReturnValue(JSON.stringify(cem));
    const result = validateManifest("/fake/cem.json", {
      requiredTags: ["docUrl", "customTag"],
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("@customTag");
  });

  it("handles empty modules gracefully", () => {
    readFileSync.mockReturnValue(JSON.stringify({ modules: [] }));
    const result = validateManifest("/fake/cem.json");
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("handles modules with no declarations", () => {
    readFileSync.mockReturnValue(
      JSON.stringify({ modules: [{ path: "src/utils.ts" }] }),
    );
    const result = validateManifest("/fake/cem.json");
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});
