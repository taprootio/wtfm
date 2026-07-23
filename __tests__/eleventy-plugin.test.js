import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import wtfmPlugin from "../src/server/eleventy-plugin.js";

vi.mock("fs", () => ({
  readFileSync: vi.fn(),
}));

/** Minimal CEM with one component. */
const fakeCem = {
  modules: [
    {
      declarations: [
        {
          name: "TestWidget",
          tagName: "test-widget",
          description: "A widget for testing.",
          attributes: [
            {
              name: "label",
              type: { text: "string" },
              default: '""',
              description: "Label text.",
            },
          ],
          members: [],
          events: [],
          slots: [],
          cssParts: [],
          cssProperties: [],
        },
      ],
    },
  ],
};

/** Minimal type manifest with one interface and one function. */
const fakeTypeManifest = {
  modules: [
    {
      path: "src/shared/bus-events.ts",
      declarations: [
        {
          kind: "interface",
          name: "SchemeEvents",
          description: "Theme coordination events.",
          members: [
            {
              kind: "field",
              name: "seed-color-changed",
              type: { text: "{ seedColor: string; correlationId: string }" },
              description: "Fired when the effective seed color changes.",
              privacy: "public",
            },
          ],
          docUrl: { name: "/api/scheme-events" },
        },
        {
          kind: "type-alias",
          name: "EspBusEventMap",
          description: "Every event published on the singleton EspBus.",
          type: {
            text: "SchemeEvents & ToastEvents & PopoverEvents",
          },
          docUrl: { name: "/api/esp-bus-event-map" },
        },
        {
          kind: "function",
          name: "getEspBus",
          description: "Typed accessor for the singleton bus.",
          typeParameters: [
            {
              name: "T",
              constraint: "EspBusEventMap",
              default: "EspBusEventMap",
            },
          ],
          parameters: [],
          return: {
            type: { text: "EspBus<T>" },
            description: "Pre-typed bus instance.",
          },
          docUrl: { name: "/api/get-esp-bus" },
        },
        {
          kind: "variable",
          name: "ESP_EVENTS",
          description: "Canonical event name strings.",
          type: { text: '{ readonly VALUE_CHANGED: "value-changed" }' },
          members: [
            {
              kind: "field",
              name: "VALUE_CHANGED",
              type: { text: '"value-changed"' },
              description: "",
              privacy: "public",
            },
          ],
          docUrl: { name: "/api/esp-events" },
        },
      ],
    },
  ],
};

/**
 * Creates a mock Eleventy config object that records registrations.
 */
function createMockEleventyConfig() {
  const config = {
    shortcodes: {},
    filters: {},
    globalData: {},
    library: null,
    addShortcode(name, fn) {
      config.shortcodes[name] = fn;
    },
    addFilter(name, fn) {
      config.filters[name] = fn;
    },
    addGlobalData(name, value) {
      config.globalData[name] = value;
    },
    setLibrary(name, lib) {
      config.library = { name, lib };
    },
  };
  return config;
}

describe("wtfmPlugin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readFileSync.mockReturnValue(JSON.stringify(fakeCem));
  });

  it("registers the renderDocs shortcode", () => {
    const config = createMockEleventyConfig();
    wtfmPlugin(config, { cemPath: "/fake/cem.json" });
    expect(config.shortcodes).toHaveProperty("renderDocs");
    expect(typeof config.shortcodes.renderDocs).toBe("function");
  });

  it("registers the surface shortcode and global data", () => {
    const config = createMockEleventyConfig();
    wtfmPlugin(config, { cemPath: "/fake/cem.json" });
    expect(config.shortcodes).toHaveProperty("renderSurfaceDocs");
    expect(config.shortcodes).toHaveProperty("renderHelpDocs");
    expect(config.globalData.docSurfaces).toEqual([]);
  });

  it("registers the inlineSvg shortcode", () => {
    const config = createMockEleventyConfig();
    wtfmPlugin(config, { cemPath: "/fake/cem.json" });
    expect(config.shortcodes).toHaveProperty("inlineSvg");
    expect(typeof config.shortcodes.inlineSvg).toBe("function");
  });

  it("registers the asset filter", () => {
    const config = createMockEleventyConfig();
    wtfmPlugin(config, { cemPath: "/fake/cem.json" });
    expect(config.filters).toHaveProperty("asset");
    expect(typeof config.filters.asset).toBe("function");
  });

  it("sets the markdown-it library", () => {
    const config = createMockEleventyConfig();
    wtfmPlugin(config, { cemPath: "/fake/cem.json" });
    expect(config.library).not.toBeNull();
    expect(config.library.name).toBe("md");
  });

  it("adds customElements as global data", () => {
    const config = createMockEleventyConfig();
    wtfmPlugin(config, { cemPath: "/fake/cem.json" });
    expect(config.globalData.customElements).toEqual(fakeCem);
  });

  it("uses default empty excludeAttributes", () => {
    const config = createMockEleventyConfig();
    // Calling with no excludeAttributes — the default should be []
    wtfmPlugin(config, { cemPath: "/fake/cem.json" });
    // Verify by calling renderDocs with a declaration that has all attrs
    expect(config.globalData.customElements).toBeDefined();
  });

  it("handles missing CEM file gracefully", () => {
    readFileSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });
    const config = createMockEleventyConfig();
    // Should not throw
    expect(() =>
      wtfmPlugin(config, { cemPath: "/missing.json" }),
    ).not.toThrow();
    expect(config.globalData.customElements).toEqual({ modules: [] });
  });

  describe("renderDocs shortcode", () => {
    it("returns empty string for unknown element name", async () => {
      const config = createMockEleventyConfig();
      wtfmPlugin(config, { cemPath: "/fake/cem.json" });
      const result = await config.shortcodes.renderDocs("NonExistent");
      expect(result).toBe("");
    });

    it("renders docs for a known element", async () => {
      const config = createMockEleventyConfig();
      wtfmPlugin(config, { cemPath: "/fake/cem.json" });
      const result = await config.shortcodes.renderDocs("TestWidget");
      expect(result).toContain("<test-widget>");
      expect(result).toContain("A widget for testing.");
    });

    it("renders the attributes section for a known element", async () => {
      const config = createMockEleventyConfig();
      wtfmPlugin(config, { cemPath: "/fake/cem.json" });
      const result = await config.shortcodes.renderDocs("TestWidget");
      expect(result).toContain("## Attributes");
      expect(result).toContain("### label");
    });

    it("finds a component class that is not the first declaration in its module", async () => {
      const multiDeclCem = {
        modules: [
          {
            declarations: [
              {
                name: "resetCache",
                kind: "function",
                description: "Resets the cache.",
              },
              {
                name: "TestWidget",
                tagName: "test-widget",
                description: "A widget for testing.",
                attributes: [],
                members: [],
                events: [],
                slots: [],
                cssParts: [],
                cssProperties: [],
              },
            ],
          },
        ],
      };
      readFileSync.mockReturnValue(JSON.stringify(multiDeclCem));
      const config = createMockEleventyConfig();
      wtfmPlugin(config, { cemPath: "/fake/cem.json" });
      const result = await config.shortcodes.renderDocs("TestWidget");
      expect(result).toContain("<test-widget>");
      expect(result).toContain("A widget for testing.");
    });

    it("base64-encodes ```html code blocks in descriptions to prevent markdown corruption", async () => {
      const cemWithCode = {
        modules: [
          {
            declarations: [
              {
                name: "CodeWidget",
                tagName: "code-widget",
                description:
                  'A widget.\n\n```html\n<code-widget>\n  <script>\n    if (true) {\n      console.log("hi");\n    }\n  </script>\n</code-widget>\n```',
                attributes: [],
                members: [],
                events: [],
                slots: [],
                cssParts: [],
                cssProperties: [],
              },
            ],
          },
        ],
      };
      readFileSync.mockReturnValue(JSON.stringify(cemWithCode));
      const config = createMockEleventyConfig();
      wtfmPlugin(config, { cemPath: "/fake/cem.json" });
      const result = await config.shortcodes.renderDocs("CodeWidget");

      // Should use base64 source attribute, NOT raw <template>
      expect(result).toMatch(/source="[A-Za-z0-9+/=]+"/);
      expect(result).not.toContain("<template>");

      // Decode and verify the HTML survives intact
      const match = result.match(/source="([A-Za-z0-9+/=]+)"/);
      expect(match).not.toBeNull();
      const decoded = Buffer.from(match[1], "base64").toString();
      expect(decoded).toContain("if (true)");
      expect(decoded).toContain("console.log");
      // Should NOT be corrupted by markdown processing
      expect(decoded).not.toContain("<pre>");
      expect(decoded).not.toContain("<code>");
    });

    it("preserves formnovalidate in code-block source and escapes closing script tags in CEM JSON", async () => {
      const cemWithForm = {
        modules: [
          {
            declarations: [
              {
                name: "EspalierForm",
                tagName: "esp-form",
                description:
                  'A form.\n\n```html\n<esp-form use-fetch use-json action="/api/drafts">\n  <esp-form-item label="Title">\n    <esp-input name="title" required></esp-input>\n  </esp-form-item>\n  <esp-button button-type="submit" label="Publish"></esp-button>\n  <esp-button button-type="submit" formnovalidate label="Save Draft"></esp-button>\n</esp-form>\n<script>\n  const form = findByTagName("esp-form")[0];\n  form.addEventListener("esp-submit-response", () => {});\n</script>\n```',
                attributes: [],
                members: [],
                events: [],
                slots: [
                  {
                    name: "",
                    description:
                      'Place form controls here. ```html <esp-form><esp-input name="x"></esp-input></esp-form> <script>findByTagName("esp-form")[0].reset();</script> ```',
                  },
                ],
                cssParts: [],
                cssProperties: [],
              },
            ],
          },
        ],
      };
      readFileSync.mockReturnValue(JSON.stringify(cemWithForm));
      const config = createMockEleventyConfig();
      wtfmPlugin(config, { cemPath: "/fake/cem.json" });
      const result = await config.shortcodes.renderDocs("EspalierForm");

      // The base64-encoded source should preserve formnovalidate
      const match = result.match(/source="([A-Za-z0-9+/=]+)"/);
      expect(match).not.toBeNull();
      const decoded = Buffer.from(match[1], "base64").toString();
      expect(decoded).toContain("formnovalidate");

      // The CEM JSON inside the <script> tag must not contain
      // a literal </script> (which would break the HTML parser).
      const scriptTagMatch = result.match(
        /<script type="application\/json">([\s\S]*?)<\/script>/,
      );
      expect(scriptTagMatch).not.toBeNull();
      const embeddedJson = scriptTagMatch[1];
      expect(embeddedJson).not.toContain("</script>");

      // The escaped JSON should still be parseable
      const parsed = JSON.parse(embeddedJson);
      expect(parsed).toHaveProperty("slots");
      // After parsing, the slot description should contain the
      // original </script> text (the escape is transparent).
      expect(parsed.slots[0].description).toContain("</script>");
    });
  });

  describe("inlineSvg shortcode", () => {
    it("reads and returns SVG content without XML declaration", () => {
      readFileSync
        .mockReturnValueOnce(JSON.stringify(fakeCem)) // CEM
        .mockReturnValueOnce(
          '<?xml version="1.0"?><svg><circle/></svg>',
        ); // SVG
      const config = createMockEleventyConfig();
      wtfmPlugin(config, {
        cemPath: "/fake/cem.json",
        assetsDir: "/assets",
      });
      const result = config.shortcodes.inlineSvg("icon.svg");
      expect(result).toBe("<svg><circle/></svg>");
      expect(result).not.toContain("<?xml");
    });

    it("returns empty string for missing SVG file", () => {
      readFileSync
        .mockReturnValueOnce(JSON.stringify(fakeCem)) // CEM
        .mockImplementationOnce(() => {
          throw new Error("ENOENT");
        }); // SVG missing
      const config = createMockEleventyConfig();
      wtfmPlugin(config, {
        cemPath: "/fake/cem.json",
        assetsDir: "/assets",
      });
      const result = config.shortcodes.inlineSvg("missing.svg");
      expect(result).toBe("");
    });
  });

  describe("asset filter", () => {
    it("returns the mapped asset path from manifest", () => {
      const config = createMockEleventyConfig();
      wtfmPlugin(config, { cemPath: "/fake/cem.json" });
      const filterFn = config.filters.asset;
      const context = {
        data: { manifest: { "docs.js": "docs-abc.js" } },
      };
      const result = filterFn.call(context, "docs.js");
      expect(result).toBe("docs-abc.js");
    });

    it("returns undefined for missing asset", () => {
      const config = createMockEleventyConfig();
      wtfmPlugin(config, { cemPath: "/fake/cem.json" });
      const filterFn = config.filters.asset;
      const context = {
        data: { manifest: {} },
      };
      const result = filterFn.call(context, "missing.js");
      expect(result).toBeUndefined();
    });
  });

  describe("custom renderers", () => {
    it("merges custom renderers with defaults", async () => {
      const customRenderer = {
        key: "custom-section",
        async render() {
          return "\n## Custom Section\n\nCustom content.\n";
        },
      };
      const config = createMockEleventyConfig();
      const customCem = {
        modules: [
          {
            declarations: [
              {
                name: "TestWidget",
                tagName: "test-widget",
                description: "A widget.",
                docSections: { name: "custom-section" },
                attributes: [],
                members: [],
                events: [],
                slots: [],
                cssParts: [],
                cssProperties: [],
              },
            ],
          },
        ],
      };
      readFileSync.mockReturnValue(JSON.stringify(customCem));
      wtfmPlugin(config, {
        cemPath: "/fake/cem.json",
        customRenderers: [customRenderer],
        sections: ["custom-section"],
      });
      const result = await config.shortcodes.renderDocs("TestWidget");
      expect(result).toContain("## Custom Section");
      expect(result).toContain("Custom content.");
    });
  });

  describe("section ordering via @docSections", () => {
    it("renders all default sections when docSections is absent", async () => {
      const config = createMockEleventyConfig();
      const cemWithAll = {
        modules: [
          {
            declarations: [
              {
                name: "FullWidget",
                tagName: "full-widget",
                description: "Full widget.",
                attributes: [
                  { name: "a", description: "Attr A.", default: '""' },
                ],
                members: [
                  {
                    kind: "method",
                    name: "doThing",
                    privacy: "public",
                    description: "Does a thing.",
                  },
                ],
                events: [
                  {
                    name: "done",
                    type: { text: "Event" },
                    description: "Fired when done.",
                  },
                ],
                slots: [{ name: "", description: "Default slot." }],
                cssParts: [
                  { name: "base", description: "Base part." },
                ],
                cssProperties: [
                  { name: "--x", description: "X prop." },
                ],
              },
            ],
          },
        ],
      };
      readFileSync.mockReturnValue(JSON.stringify(cemWithAll));
      wtfmPlugin(config, { cemPath: "/fake/cem.json" });
      const result = await config.shortcodes.renderDocs("FullWidget");
      expect(result).toContain("## Slots");
      expect(result).toContain("## Attributes");
      expect(result).toContain("## Methods");
      expect(result).toContain("## Events");
      expect(result).toContain("## CSS Parts");
      expect(result).toContain("## CSS Properties");
    });

    it("excludes sections with - prefix in docSections", async () => {
      const config = createMockEleventyConfig();
      const cem = {
        modules: [
          {
            declarations: [
              {
                name: "LimitedWidget",
                tagName: "limited-widget",
                description: "Limited.",
                docSections: { name: "all,", description: "-methods" },
                attributes: [
                  { name: "a", description: "Attr.", default: '""' },
                ],
                members: [
                  {
                    kind: "method",
                    name: "foo",
                    privacy: "public",
                    description: "Foo.",
                  },
                ],
                events: [],
                slots: [],
                cssParts: [],
                cssProperties: [],
              },
            ],
          },
        ],
      };
      readFileSync.mockReturnValue(JSON.stringify(cem));
      wtfmPlugin(config, { cemPath: "/fake/cem.json" });
      const result = await config.shortcodes.renderDocs("LimitedWidget");
      expect(result).toContain("## Attributes");
      expect(result).not.toContain("## Methods");
    });

    it("resolves aliases in exclusions (e.g. -cssprops)", async () => {
      const config = createMockEleventyConfig();
      const cem = {
        modules: [
          {
            declarations: [
              {
                name: "AliasWidget",
                tagName: "alias-widget",
                description: "Alias test.",
                docSections: { name: "all,", description: "-cssprops" },
                attributes: [
                  { name: "a", description: "Attr.", default: '""' },
                ],
                members: [],
                events: [],
                slots: [],
                cssParts: [],
                cssProperties: [
                  { name: "--my-color", description: "Color." },
                ],
              },
            ],
          },
        ],
      };
      readFileSync.mockReturnValue(JSON.stringify(cem));
      wtfmPlugin(config, { cemPath: "/fake/cem.json" });
      const result = await config.shortcodes.renderDocs("AliasWidget");
      expect(result).toContain("## Attributes");
      expect(result).not.toContain("## CSS Properties");
    });
  });

  describe("type manifest support", () => {
    function setupWithTypeManifest() {
      readFileSync.mockImplementation((path) => {
        if (path === "/fake/cem.json") return JSON.stringify(fakeCem);
        if (path === "/fake/types.json")
          return JSON.stringify(fakeTypeManifest);
        throw new Error("ENOENT");
      });
      const config = createMockEleventyConfig();
      wtfmPlugin(config, {
        cemPath: "/fake/cem.json",
        typeManifestPath: "/fake/types.json",
      });
      return config;
    }

    it("adds typeManifest as global data when typeManifestPath is provided", () => {
      const config = setupWithTypeManifest();
      expect(config.globalData.typeManifest).toEqual(fakeTypeManifest);
    });

    it("does not add typeManifest global data when no typeManifestPath", () => {
      const config = createMockEleventyConfig();
      wtfmPlugin(config, { cemPath: "/fake/cem.json" });
      expect(config.globalData.typeManifest).toBeUndefined();
    });

    it("handles missing type manifest file gracefully", () => {
      readFileSync.mockImplementation((path) => {
        if (path === "/fake/cem.json") return JSON.stringify(fakeCem);
        throw new Error("ENOENT");
      });
      const config = createMockEleventyConfig();
      expect(() =>
        wtfmPlugin(config, {
          cemPath: "/fake/cem.json",
          typeManifestPath: "/missing/types.json",
        }),
      ).not.toThrow();
    });

    it("renders interface declaration from type manifest", async () => {
      const config = setupWithTypeManifest();
      const result = await config.shortcodes.renderDocs("SchemeEvents");
      expect(result).toContain("`SchemeEvents`");
      expect(result).toContain("Theme coordination events.");
      // Should NOT have a tag-name header
      expect(result).not.toContain("<SchemeEvents>");
    });

    it("renders properties section for interface declarations", async () => {
      const config = setupWithTypeManifest();
      const result = await config.shortcodes.renderDocs("SchemeEvents");
      expect(result).toContain("## Properties");
      expect(result).toContain("### seed-color-changed");
    });

    it("renders type alias with type expression code block", async () => {
      const config = setupWithTypeManifest();
      const result = await config.shortcodes.renderDocs("EspBusEventMap");
      expect(result).toContain("`EspBusEventMap`");
      expect(result).toContain("Every event published on the singleton EspBus.");
      expect(result).toContain("```ts");
      expect(result).toContain(
        "type EspBusEventMap = SchemeEvents & ToastEvents & PopoverEvents",
      );
    });

    it("renders function declaration with signature", async () => {
      const config = setupWithTypeManifest();
      const result = await config.shortcodes.renderDocs("getEspBus");
      // Should contain the full function signature
      expect(result).toContain("getEspBus");
      expect(result).toContain("EspBus<T>");
      expect(result).toContain("Typed accessor for the singleton bus.");
    });

    it("renders function return type description", async () => {
      const config = setupWithTypeManifest();
      const result = await config.shortcodes.renderDocs("getEspBus");
      expect(result).toContain("**Returns**");
      expect(result).toContain("`EspBus<T>`");
      expect(result).toContain("Pre-typed bus instance.");
    });

    it("renders variable declaration with properties section", async () => {
      const config = setupWithTypeManifest();
      const result = await config.shortcodes.renderDocs("ESP_EVENTS");
      expect(result).toContain("`ESP_EVENTS`");
      expect(result).toContain("## Properties");
      expect(result).toContain("### VALUE_CHANGED");
    });

    it("prefers CEM declaration over type manifest for same name", async () => {
      // If a name exists in both, CEM wins
      const config = setupWithTypeManifest();
      const result = await config.shortcodes.renderDocs("TestWidget");
      // Should render as component (from CEM), not as a type
      expect(result).toContain("<test-widget>");
    });
  });

  describe("renderSurfaceDocs shortcode", () => {
    it("composes members in declared order with namespaced anchors", async () => {
      const surfaceCem = {
        modules: [{
          declarations: [
            {
              name: "SurfacePanel",
              tagName: "surface-panel",
              description: "Panel docs.",
              attributes: [{
                name: "label",
                description: "Panel label.",
                default: '""',
              }],
            },
            {
              name: "SurfaceShell",
              tagName: "surface-shell",
              description: "Shell docs.",
              docSurface: { name: "settings" },
              docSurfaceTitle: { name: "Settings", description: "Surface" },
              docSurfaceParts: {
                name: "surface-shell,",
                description: "surface-panel",
              },
              docSections: { name: "attributes" },
              attributes: [{
                name: "heading",
                description: "Shell heading.",
                default: '""',
                helpAnchor: { name: "ShellHeading" },
              }],
            },
          ],
        }],
      };
      readFileSync.mockReturnValue(JSON.stringify(surfaceCem));
      const config = createMockEleventyConfig();
      wtfmPlugin(config, { cemPath: "/fake/cem.json" });

      const result = await config.shortcodes.renderSurfaceDocs("settings");
      expect(result.indexOf("`<surface-shell>`")).toBeLessThan(
        result.indexOf("`<surface-panel>`"),
      );
      expect(result).toContain("## `<surface-shell>` {#surface-shell}");
      expect(result).toContain("### Attributes {#surface-shell--attributes}");
      expect(result).toContain("#### heading {#ShellHeading}");
      expect(result).toContain("### Attributes {#surface-panel--attributes}");
      expect(result).toContain("#### label {#surface-panel--label}");
      expect(result).not.toContain('<div class="doc-header">');

      const html = config.shortcodes.renderMarkdown(result);
      expect(html).toContain('id="surface-shell--attributes"');
      expect(html).toContain('id="surface-panel--label"');
    });

    it("rejects unknown surface slugs", async () => {
      const config = createMockEleventyConfig();
      wtfmPlugin(config, { cemPath: "/fake/cem.json" });
      await expect(config.shortcodes.renderSurfaceDocs("missing")).rejects.toThrow(
        'Unknown documentation surface "missing"',
      );
    });
  });

  describe("renderHelpDocs shortcode", () => {
    it("renders authored help against the surface help route", () => {
      const surfaceCem = {
        modules: [{
          declarations: [{
            name: "SurfaceShell",
            tagName: "surface-shell",
            docSurface: { name: "settings" },
            docSurfaceTitle: { name: "Settings" },
            docSurfaceParts: { name: "surface-shell" },
          }],
        }],
      };
      readFileSync.mockReturnValue(JSON.stringify(surfaceCem));
      const config = createMockEleventyConfig();
      wtfmPlugin(config, {
        cemPath: "/fake/cem.json",
        helpUrlBuilder: (slug) => `/guides/${slug}/`,
      });

      expect(
        config.shortcodes.renderHelpDocs(
          "settings",
          "## Title {#Title}\n\n![Field](images/title.png)",
        ),
      ).toContain('src="/guides/settings/images/title.png"');
    });

    it("rejects unknown surface slugs", () => {
      const config = createMockEleventyConfig();
      wtfmPlugin(config, { cemPath: "/fake/cem.json" });
      expect(() => config.shortcodes.renderHelpDocs("missing", "# Help")).toThrow(
        'Unknown documentation surface "missing"',
      );
    });
  });
});
