import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import wtfmCemPlugin, {
  parseTagValue,
  recoverTagsFromSource,
  extractExamples,
  extractExamplesFromBlock,
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

  it("recovers menuOrder tag from source", () => {
    const source = `
/**
 * An ordered component.
 *
 * @docPageTitle Ordered
 * @docUrl /components/ordered
 * @menuGroup Layout
 * @menuOrder 3
 */
interface Blocker {}

@customElement("esp-ordered")
export class EspOrdered extends LitElement {}
`;
    readFileSync.mockReturnValue(source);

    const manifest = {
      modules: [
        {
          path: "src/ordered/esp-ordered.ts",
          declarations: [
            {
              name: "EspOrdered",
              tagName: "esp-ordered",
              customElement: true,
            },
          ],
        },
      ],
    };

    const plugin = wtfmCemPlugin();
    plugin.packageLinkPhase({ customElementsManifest: manifest });

    const decl = manifest.modules[0].declarations[0];
    expect(decl.menuOrder).toEqual({
      name: "3",
      description: "",
    });
  });

  it("does not overwrite tags on declarations that already have them", () => {
    readFileSync.mockReturnValue(`
      /**
       * A button.
       * @docUrl /components/button
       * @docPageTitle Button
       */
      @customElement("esp-button")
      export class EspButton extends LitElement {}
    `);

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

    // Tags should not be overwritten
    const decl = manifest.modules[0].declarations[0];
    expect(decl.docUrl).toEqual({ name: "/components/button", description: "" });
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

  it("reads each module source file only once (caches per path)", () => {
    readFileSync.mockReturnValue(`
      /**
       * @docPageTitle Alpha
       * @docUrl /components/alpha
       */
      @customElement("alpha-el")
      export class AlphaEl extends LitElement {}

      /**
       * @docPageTitle Beta
       * @docUrl /components/beta
       */
      @customElement("beta-el")
      export class BetaEl extends LitElement {}
    `);

    const manifest = {
      modules: [
        {
          path: "src/multi.ts",
          declarations: [
            {
              name: "AlphaEl",
              tagName: "alpha-el",
              customElement: true,
            },
            {
              name: "BetaEl",
              tagName: "beta-el",
              customElement: true,
            },
          ],
        },
      ],
    };

    const plugin = wtfmCemPlugin();
    plugin.packageLinkPhase({ customElementsManifest: manifest });

    // File should only be read once despite two declarations.
    expect(readFileSync).toHaveBeenCalledTimes(1);
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

    // Both modules read (tags only recovered for missing, but
    // examples are extracted for both).
    expect(readFileSync).toHaveBeenCalledTimes(2);

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

  it("extracts @example blocks and stores them as decl.examples", () => {
    const source = `
/**
 * A hero section.
 *
 * @docPageTitle Hero
 * @docUrl /components/hero
 *
 * @example Simple hero
 * \`\`\`html
 * <taproot-hero hero-title="Hello"></taproot-hero>
 * \`\`\`
 *
 * @example Hero with image
 * \`\`\`html
 * <taproot-hero hero-title="Photo" layout="split">
 *   <img slot="media" src="photo.jpg" />
 * </taproot-hero>
 * \`\`\`
 */
@customElement("taproot-hero")
export class TaprootHero extends EspalierElementBase {}
`;
    readFileSync.mockReturnValue(source);

    const manifest = {
      modules: [
        {
          path: "src/hero/taproot-hero.ts",
          declarations: [
            {
              name: "TaprootHero",
              tagName: "taproot-hero",
              customElement: true,
              docUrl: { name: "/components/hero", description: "" },
            },
          ],
        },
      ],
    };

    const plugin = wtfmCemPlugin();
    plugin.packageLinkPhase({ customElementsManifest: manifest });

    const decl = manifest.modules[0].declarations[0];
    expect(decl.examples).toHaveLength(2);
    expect(decl.examples[0].title).toBe("Simple hero");
    expect(decl.examples[0].body).toContain("taproot-hero");
    expect(decl.examples[1].title).toBe("Hero with image");
    expect(decl.examples[1].body).toContain('layout="split"');
  });

  it("scopes examples to the correct declaration in multi-class files", () => {
    const source = `
/**
 * @example Alpha example
 * \`\`\`html
 * <alpha-el></alpha-el>
 * \`\`\`
 */
@customElement("alpha-el")
export class AlphaEl extends LitElement {}

/**
 * @example Beta example
 * \`\`\`html
 * <beta-el></beta-el>
 * \`\`\`
 */
@customElement("beta-el")
export class BetaEl extends LitElement {}
`;
    readFileSync.mockReturnValue(source);

    const manifest = {
      modules: [
        {
          path: "src/multi.ts",
          declarations: [
            {
              name: "AlphaEl",
              tagName: "alpha-el",
              customElement: true,
              docUrl: { name: "/alpha", description: "" },
            },
            {
              name: "BetaEl",
              tagName: "beta-el",
              customElement: true,
              docUrl: { name: "/beta", description: "" },
            },
          ],
        },
      ],
    };

    const plugin = wtfmCemPlugin();
    plugin.packageLinkPhase({ customElementsManifest: manifest });

    const alphaDecl = manifest.modules[0].declarations[0];
    const betaDecl = manifest.modules[0].declarations[1];

    expect(alphaDecl.examples).toHaveLength(1);
    expect(alphaDecl.examples[0].title).toBe("Alpha example");
    expect(alphaDecl.examples[0].body).toContain("alpha-el");

    expect(betaDecl.examples).toHaveLength(1);
    expect(betaDecl.examples[0].title).toBe("Beta example");
    expect(betaDecl.examples[0].body).toContain("beta-el");
  });

  it("does not overwrite existing examples", () => {
    readFileSync.mockReturnValue(`
      /**
       * @docUrl /foo
       * @example From source
       * \`\`\`html
       * <my-el></my-el>
       * \`\`\`
       */
      @customElement("my-el")
      export class MyEl extends LitElement {}
    `);

    const existingExamples = [{ title: "Pre-existing", body: "<div></div>" }];
    const manifest = {
      modules: [
        {
          path: "src/my-el.ts",
          declarations: [
            {
              name: "MyEl",
              tagName: "my-el",
              customElement: true,
              docUrl: { name: "/foo", description: "" },
              examples: existingExamples,
            },
          ],
        },
      ],
    };

    const plugin = wtfmCemPlugin();
    plugin.packageLinkPhase({ customElementsManifest: manifest });

    const decl = manifest.modules[0].declarations[0];
    expect(decl.examples).toBe(existingExamples);
    expect(decl.examples[0].title).toBe("Pre-existing");
  });
});

// ── extractExamplesFromBlock ─────────────────────────────────────

describe("extractExamplesFromBlock", () => {
  it("extracts examples from a single JSDoc block", () => {
    const block = `/**
 * A component.
 *
 * @example Basic usage
 * \`\`\`html
 * <my-el>Hello</my-el>
 * \`\`\`
 */`;
    const result = extractExamplesFromBlock(block);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Basic usage");
    expect(result[0].body).toContain("<my-el>Hello</my-el>");
  });

  it("returns empty array when no @example tags exist", () => {
    const block = `/**
 * Just a description.
 * @param x - something
 */`;
    const result = extractExamplesFromBlock(block);
    expect(result).toEqual([]);
  });
});

// ── extractExamples (declaration-aware) ──────────────────────────

describe("extractExamples", () => {
  it("extracts a single @example with title and html body", () => {
    const source = `
/**
 * A component.
 *
 * @example Basic usage
 * \`\`\`html
 * <my-el>Hello</my-el>
 * \`\`\`
 */
export class MyEl {}
`;
    const result = extractExamples(source);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Basic usage");
    expect(result[0].body).toContain("<my-el>Hello</my-el>");
  });

  it("extracts multiple @example blocks", () => {
    const source = `
/**
 * @example First
 * \`\`\`html
 * <my-el first></my-el>
 * \`\`\`
 *
 * @example Second
 * \`\`\`html
 * <my-el second></my-el>
 * \`\`\`
 */
export class MyEl {}
`;
    const result = extractExamples(source);
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe("First");
    expect(result[1].title).toBe("Second");
  });

  it("handles @example with no title", () => {
    const source = `
/**
 * @example
 * \`\`\`html
 * <my-el></my-el>
 * \`\`\`
 */
export class MyEl {}
`;
    const result = extractExamples(source);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("");
    expect(result[0].body).toContain("<my-el>");
  });

  it("stops collecting body when another @tag appears", () => {
    const source = `
/**
 * @example Usage
 * \`\`\`html
 * <my-el></my-el>
 * \`\`\`
 * @slot default - The main slot
 */
export class MyEl {}
`;
    const result = extractExamples(source);
    expect(result).toHaveLength(1);
    expect(result[0].body).not.toContain("@slot");
  });

  it("returns empty array when no @example tags exist", () => {
    const source = `
/**
 * Just a description.
 * @param x - something
 */
export class MyEl {}
`;
    const result = extractExamples(source);
    expect(result).toEqual([]);
  });

  it("scopes to the correct class when declName is provided", () => {
    const source = `
/**
 * @example Alpha example
 * \`\`\`html
 * <alpha-el></alpha-el>
 * \`\`\`
 */
@customElement("alpha-el")
export class AlphaEl extends LitElement {}

/**
 * @example Beta example
 * \`\`\`html
 * <beta-el></beta-el>
 * \`\`\`
 */
@customElement("beta-el")
export class BetaEl extends LitElement {}
`;
    const alphaResult = extractExamples(source, "AlphaEl");
    expect(alphaResult).toHaveLength(1);
    expect(alphaResult[0].title).toBe("Alpha example");

    const betaResult = extractExamples(source, "BetaEl");
    expect(betaResult).toHaveLength(1);
    expect(betaResult[0].title).toBe("Beta example");
  });

  it("falls back to first JSDoc block when declName is not found", () => {
    const source = `
/**
 * @example Fallback example
 * \`\`\`html
 * <my-el></my-el>
 * \`\`\`
 */
class UnrelatedClass {}
`;
    const result = extractExamples(source, "NonExistentClass");
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Fallback example");
  });

  it("falls back when declName is not provided", () => {
    const source = `
/**
 * @example First block
 * \`\`\`html
 * <first></first>
 * \`\`\`
 */
class A {}

/**
 * @example Second block
 * \`\`\`html
 * <second></second>
 * \`\`\`
 */
class B {}
`;
    const result = extractExamples(source);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("First block");
  });
});
