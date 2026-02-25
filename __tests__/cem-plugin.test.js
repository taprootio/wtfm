import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import wtfmCemPlugin, {
  parseTagValue,
  recoverTagsFromSource,
} from "../src/server/cem-plugin.js";

vi.mock("fs", () => ({
  readFileSync: vi.fn(),
}));

// ── parseTagValue ────────────────────────────────────────────────

describe("parseTagValue", () => {
  it("returns name with empty description for a single word", () => {
    expect(parseTagValue("Box")).toEqual({ name: "Box", description: "" });
  });

  it("splits multi-word values into name and description", () => {
    expect(parseTagValue("Date Picker")).toEqual({
      name: "Date",
      description: "Picker",
    });
  });

  it("handles three-word values", () => {
    expect(parseTagValue("Vertical Menu Group")).toEqual({
      name: "Vertical",
      description: "Menu Group",
    });
  });

  it("handles URL-like values", () => {
    expect(parseTagValue("/components/button")).toEqual({
      name: "/components/button",
      description: "",
    });
  });

  it("trims whitespace", () => {
    expect(parseTagValue("  Button  ")).toEqual({
      name: "Button",
      description: "",
    });
  });
});

// ── recoverTagsFromSource ────────────────────────────────────────

describe("recoverTagsFromSource", () => {
  const tags = ["docUrl", "menuLabel", "menuGroup", "docPageTitle"];

  it("recovers tags from a standard JSDoc block", () => {
    const source = `
/**
 * Some component description.
 *
 * @docPageTitle Vertical Menu
 * @docUrl /components/vertical-menu
 * @menuGroup Navigation
 * @menuLabel Vertical Menu
 */
@customElement("my-component")
export class MyComponent extends LitElement {}
`;
    const result = recoverTagsFromSource(source, tags);
    expect(result).toEqual({
      docPageTitle: { name: "Vertical", description: "Menu" },
      docUrl: { name: "/components/vertical-menu", description: "" },
      menuGroup: { name: "Navigation", description: "" },
      menuLabel: { name: "Vertical", description: "Menu" },
    });
  });

  it("recovers tags when an interface separates JSDoc from the class", () => {
    const source = `
/**
 * A component with misplaced JSDoc.
 *
 * @docPageTitle Color Picker
 * @docUrl /components/color-picker
 * @menuGroup Pickers
 * @menuLabel Color Picker
 */
interface SomeInternalNode {
  kind: "item";
  label: string;
}

@customElement("my-picker")
export class MyPicker extends LitElement {}
`;
    const result = recoverTagsFromSource(source, tags);
    expect(result).toEqual({
      docPageTitle: { name: "Color", description: "Picker" },
      docUrl: { name: "/components/color-picker", description: "" },
      menuGroup: { name: "Pickers", description: "" },
      menuLabel: { name: "Color", description: "Picker" },
    });
  });

  it("returns null when no JSDoc blocks contain doc tags", () => {
    const source = `
/**
 * Just a plain description.
 * @param foo - a parameter
 */
export class PlainClass {}
`;
    const result = recoverTagsFromSource(source, tags);
    expect(result).toBeNull();
  });

  it("returns null for source with no JSDoc blocks", () => {
    const source = `export const x = 1;`;
    const result = recoverTagsFromSource(source, tags);
    expect(result).toBeNull();
  });

  it("uses the first JSDoc block that has doc tags", () => {
    const source = `
/**
 * Unrelated helper.
 * @param x - something
 */
function helper() {}

/**
 * The component.
 * @docPageTitle Button
 * @docUrl /components/button
 */
@customElement("my-button")
export class MyButton extends LitElement {}
`;
    const result = recoverTagsFromSource(source, tags);
    expect(result).toEqual({
      docPageTitle: { name: "Button", description: "" },
      docUrl: { name: "/components/button", description: "" },
    });
  });

  it("only returns requested tags", () => {
    const source = `
/**
 * @docPageTitle Button
 * @docUrl /components/button
 * @menuLabel Button
 */
@customElement("my-button")
export class MyButton extends LitElement {}
`;
    const result = recoverTagsFromSource(source, ["docUrl"]);
    expect(result).toEqual({
      docUrl: { name: "/components/button", description: "" },
    });
  });

  it("handles single-line JSDoc blocks", () => {
    const source = `/** @docUrl /components/foo @docPageTitle Foo */`;
    // Each tag is on the same line; the regex matches each one.
    const result = recoverTagsFromSource(source, ["docUrl", "docPageTitle"]);
    // @docUrl captures "/components/foo" up to end of that match segment
    expect(result).not.toBeNull();
    expect(result.docUrl.name).toBe("/components/foo");
  });
});

// ── wtfmCemPlugin (full integration) ─────────────────────────────

describe("wtfmCemPlugin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a plugin object with name and packageLinkPhase", () => {
    const plugin = wtfmCemPlugin();
    expect(plugin.name).toBe("wtfm-cem-plugin");
    expect(typeof plugin.packageLinkPhase).toBe("function");
  });

  it("recovers tags for a custom element declaration missing all tags", () => {
    const source = `
/**
 * A vertical menu component.
 *
 * @docPageTitle Vertical Menu
 * @docUrl /components/vertical-menu
 * @menuGroup Navigation
 * @menuLabel Vertical Menu
 * @menuIcon menu-deep
 */
interface DrawerNode {
  kind: "item";
}

@customElement("esp-vertical-menu")
export class EspalierVerticalMenu extends LitElement {}
`;
    readFileSync.mockReturnValue(source);

    const manifest = {
      modules: [
        {
          path: "src/vertical-menu/esp-vertical-menu.ts",
          declarations: [
            {
              name: "EspalierVerticalMenu",
              tagName: "esp-vertical-menu",
              customElement: true,
              // No doc tags — they were lost to the interface
            },
          ],
        },
      ],
    };

    const plugin = wtfmCemPlugin();
    plugin.packageLinkPhase({ customElementsManifest: manifest });

    const decl = manifest.modules[0].declarations[0];
    expect(decl.docPageTitle).toEqual({
      name: "Vertical",
      description: "Menu",
    });
    expect(decl.docUrl).toEqual({
      name: "/components/vertical-menu",
      description: "",
    });
    expect(decl.menuGroup).toEqual({
      name: "Navigation",
      description: "",
    });
    expect(decl.menuLabel).toEqual({
      name: "Vertical",
      description: "Menu",
    });
    expect(decl.menuIcon).toEqual({
      name: "menu-deep",
      description: "",
    });
  });

  it("does not modify declarations that already have tags", () => {
    const manifest = {
      modules: [
        {
          path: "src/button/esp-button.ts",
          declarations: [
            {
              name: "EspButton",
              tagName: "esp-button",
              customElement: true,
              docUrl: { name: "/components/button", description: "" },
              docPageTitle: { name: "Button", description: "" },
            },
          ],
        },
      ],
    };

    const plugin = wtfmCemPlugin();
    plugin.packageLinkPhase({ customElementsManifest: manifest });

    // readFileSync should never have been called
    expect(readFileSync).not.toHaveBeenCalled();
  });

  it("skips declarations that are not custom elements", () => {
    readFileSync.mockReturnValue("/** @docUrl /foo */\nclass Foo {}");

    const manifest = {
      modules: [
        {
          path: "src/utils.ts",
          declarations: [
            {
              name: "SomeHelper",
              // No tagName, no customElement flag
            },
          ],
        },
      ],
    };

    const plugin = wtfmCemPlugin();
    plugin.packageLinkPhase({ customElementsManifest: manifest });

    expect(readFileSync).not.toHaveBeenCalled();
  });

  it("handles missing source files gracefully", () => {
    readFileSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });

    const manifest = {
      modules: [
        {
          path: "src/missing/gone.ts",
          declarations: [
            {
              name: "GoneComponent",
              tagName: "gone-component",
              customElement: true,
            },
          ],
        },
      ],
    };

    const plugin = wtfmCemPlugin();
    // Should not throw
    expect(() =>
      plugin.packageLinkPhase({ customElementsManifest: manifest }),
    ).not.toThrow();
  });

  it("handles source files with no matching JSDoc blocks", () => {
    readFileSync.mockReturnValue(`
      /** Just a plain class. */
      @customElement("plain-el")
      export class PlainEl extends LitElement {}
    `);

    const manifest = {
      modules: [
        {
          path: "src/plain-el.ts",
          declarations: [
            {
              name: "PlainEl",
              tagName: "plain-el",
              customElement: true,
            },
          ],
        },
      ],
    };

    const plugin = wtfmCemPlugin();
    plugin.packageLinkPhase({ customElementsManifest: manifest });

    const decl = manifest.modules[0].declarations[0];
    expect(decl.docUrl).toBeUndefined();
  });

  it("accepts custom tag names via options", () => {
    readFileSync.mockReturnValue(`
      /**
       * @myCustomTag Hello World
       */
      @customElement("my-el")
      export class MyEl extends LitElement {}
    `);

    const manifest = {
      modules: [
        {
          path: "src/my-el.ts",
          declarations: [
            {
              name: "MyEl",
              tagName: "my-el",
              customElement: true,
            },
          ],
        },
      ],
    };

    const plugin = wtfmCemPlugin({ tags: ["myCustomTag"] });
    plugin.packageLinkPhase({ customElementsManifest: manifest });

    const decl = manifest.modules[0].declarations[0];
    expect(decl.myCustomTag).toEqual({
      name: "Hello",
      description: "World",
    });
  });

  it("processes multiple modules, only recovering where needed", () => {
    readFileSync.mockReturnValue(`
      /**
       * @docPageTitle Missing Component
       * @docUrl /components/missing
       */
      interface Blocker {}
      @customElement("missing-el")
      export class MissingEl extends LitElement {}
    `);

    const manifest = {
      modules: [
        {
          path: "src/good.ts",
          declarations: [
            {
              name: "GoodEl",
              tagName: "good-el",
              customElement: true,
              docUrl: { name: "/components/good", description: "" },
            },
          ],
        },
        {
          path: "src/missing.ts",
          declarations: [
            {
              name: "MissingEl",
              tagName: "missing-el",
              customElement: true,
              // Missing tags
            },
          ],
        },
      ],
    };

    const plugin = wtfmCemPlugin();
    plugin.packageLinkPhase({ customElementsManifest: manifest });

    // Good module untouched — file not read
    expect(readFileSync).toHaveBeenCalledTimes(1);

    // Missing module recovered
    const decl = manifest.modules[1].declarations[0];
    expect(decl.docPageTitle).toEqual({
      name: "Missing",
      description: "Component",
    });
    expect(decl.docUrl).toEqual({
      name: "/components/missing",
      description: "",
    });
  });
});
