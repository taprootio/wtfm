import { describe, it, expect } from "vitest";
import { mkdtempSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import wtfmPlugin from "../src/server/eleventy-plugin.js";
import { collectSurfaces } from "../src/server/surfaces.js";
import { defaultRenderers } from "../src/server/section-renderers/index.js";
import { emitTaprootDocsArtifact } from "../src/server/taproot-docs/emit.js";

// A real 1×1 PNG blessed by the contract package's own fixtures — the
// directory validator fully decodes images, so hand-crafted headers with
// fake payloads are (correctly) rejected.
const png = Buffer.from(
  readFileSync(
    new URL(
      "../node_modules/@taprootio/docs-artifact/fixtures/valid/complete/taproot-docs/assets/pixel.png.base64",
      import.meta.url,
    ),
    "utf-8",
  ).trim(),
  "base64",
);

function makeCem() {
  return {
    modules: [
      {
        path: "src/components/test-widget.ts",
        declarations: [
          {
            name: "TestWidget",
            tagName: "test-widget",
            description: "A widget that does widget things.",
            docSurface: { name: "widget" },
            docSurfaceTitle: { name: "Widget surface" },
            docSurfaceParts: { name: "test-widget" },
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
}

function makeRenderDeclaration() {
  return async (declaration, overrides) => {
    let markdown = `\n${declaration.description ?? ""}\n`;
    for (const renderer of defaultRenderers) {
      markdown += await renderer.render(declaration, {
        excludeAttributes: [],
        attributeExceptions: {},
        pathPrefix: "/",
        ...overrides,
      });
    }
    return markdown;
  };
}

const source = {
  provider: "github",
  repositoryId: "R_kgDOexample",
  repository: "taprootio/docs-fixture",
  repositoryUrl: "https://github.com/taprootio/docs-fixture",
  revision: "0123456789abcdef0123456789abcdef01234567",
  ref: "refs/heads/main",
};

function makeOptions(overrides = {}) {
  return {
    source,
    ciEnvironment: false,
    defaultLocale: "en-US",
    localeLabel: "English",
    navigation: [
      {
        label: "Guides",
        children: [{ label: "Getting started", resourceKey: "guide:getting-started" }],
      },
      { label: "Widget", resourceKey: "reference:widget" },
    ],
    assets: [],
    sourceDateEpoch: 1767225600,
    ...overrides,
  };
}

function makeDocuments(overrides = {}) {
  return [
    {
      key: "guide:getting-started",
      kind: "guide",
      audiences: ["developer"],
      tags: ["quickstart"],
      description: "Install and run.",
      redirectsFrom: [{ from: "/old-start/", status: 301 }],
      assets: [{ key: "diagram-overview", source: "assets/overview.bin" }],
      title: "Getting started",
      route: "/guides/getting-started/",
      inputPath: "guides/getting-started.md",
      rawInput:
        "## Install\n\nSee [the widget](/surfaces/widget/).\n\n![Overview](assets/overview.bin)\n",
      ...overrides,
    },
  ];
}

async function emit({ documents = makeDocuments(), options = makeOptions(), io, outputDirectory } = {}) {
  const cem = makeCem();
  const directory = outputDirectory ?? mkdtempSync(join(tmpdir(), "taproot-docs-emit-"));
  const result = await emitTaprootDocsArtifact(
    {
      options,
      documents,
      surfaces: collectSurfaces(cem),
      customElements: cem,
      renderDeclaration: makeRenderDeclaration(),
      outputDirectory: directory,
      projectRoot: directory,
    },
    { readAssetFile: (assetSource) => {
      if (assetSource !== "assets/overview.bin") throw new Error(`ENOENT: ${assetSource}`);
      return png;
    }, ...io },
  );
  return { directory, result };
}

describe("emitTaprootDocsArtifact", () => {
  it("writes a directory-validated artifact beside the ordinary output", async () => {
    const { directory, result } = await emit();

    expect(result).toEqual({ resourceCount: 2, assetCount: 1, redirectCount: 1 });
    const manifest = JSON.parse(
      readFileSync(join(directory, "taproot-docs-manifest.json"), "utf-8"),
    );
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.build.producer).toBe("@taprootio/wtfm");
    expect(manifest.build.sourceDateEpoch).toBe(1767225600);
    expect(manifest.resources.map((resource) => resource.key)).toEqual([
      "guide:getting-started",
      "reference:widget",
    ]);
    const guide = manifest.resources[0].variants[0];
    expect(guide.route).toBe("/guides/getting-started/");
    expect(guide.source.url).toBe(
      "https://github.com/taprootio/docs-fixture/blob/0123456789abcdef0123456789abcdef01234567/guides/getting-started.md",
    );
    expect(guide.headings).toEqual([{ id: "install", text: "Install", level: 2 }]);
    expect(manifest.redirects).toEqual([
      { from: "/old-start/", toResourceKey: "guide:getting-started", locale: "en-US", status: 301 },
    ]);
    expect(manifest.assets[0]).toMatchObject({ key: "diagram-overview", width: 1, height: 1 });

    const fragment = readFileSync(
      join(directory, guide.fragments?.[0]?.path ?? manifest.resources[0].variants[0].fragments[0].path),
      "utf-8",
    );
    expect(fragment).toContain('<a data-resource-key="reference:widget">the widget</a>');
    expect(fragment).toContain('<img data-asset-key="diagram-overview" alt="Overview" width="1" height="1">');
  });

  it("emits byte-identical manifests and fragments across repeated builds", async () => {
    const first = await emit();
    const second = await emit();
    const read = (directory, path) => readFileSync(join(directory, path));
    expect(read(first.directory, "taproot-docs-manifest.json"))
      .toEqual(read(second.directory, "taproot-docs-manifest.json"));
    const manifest = JSON.parse(
      readFileSync(join(first.directory, "taproot-docs-manifest.json"), "utf-8"),
    );
    for (const resource of manifest.resources) {
      const path = resource.variants[0].fragments[0].path;
      expect(read(first.directory, path)).toEqual(read(second.directory, path));
    }
  });

  it("resets a stale artifact subtree before writing", async () => {
    const directory = mkdtempSync(join(tmpdir(), "taproot-docs-emit-"));
    mkdirSync(join(directory, "taproot-docs", "fragments"), { recursive: true });
    writeFileSync(join(directory, "taproot-docs", "fragments", "stale.html"), "<p>old</p>");

    await emit({ outputDirectory: directory });

    expect(existsSync(join(directory, "taproot-docs", "fragments", "stale.html"))).toBe(false);
  });

  it("fails closed when no deterministic timestamp source exists", async () => {
    await expect(emit({
      options: makeOptions({ sourceDateEpoch: null }),
      io: { resolveFallbackTimestamp: () => null },
    })).rejects.toThrow(/no deterministic build timestamp/u);
  });

  it("falls back to the injected repository timestamp", async () => {
    const { directory } = await emit({
      options: makeOptions({ sourceDateEpoch: null }),
      io: { resolveFallbackTimestamp: () => 1700000000 },
    });
    const manifest = JSON.parse(
      readFileSync(join(directory, "taproot-docs-manifest.json"), "utf-8"),
    );
    expect(manifest.build.sourceDateEpoch).toBe(1700000000);
  });

  it("rejects navigation entries that reference unknown resources", async () => {
    await expect(emit({
      options: makeOptions({ navigation: [{ label: "Ghost", resourceKey: "guide:missing" }] }),
    })).rejects.toThrow(/navigation\[0\] references unknown resource key "guide:missing"/u);
  });

  it("rejects resource keys claimed by both a document and a surface", async () => {
    await expect(emit({
      documents: makeDocuments({ key: "reference:widget", redirectsFrom: [], assets: [] }),
      options: makeOptions({
        navigation: [{ label: "Widget", resourceKey: "reference:widget" }],
      }),
    })).rejects.toThrow(/resource key "reference:widget" is declared by both/u);
  });

  it("rejects duplicate canonical routes", async () => {
    await expect(emit({
      documents: makeDocuments({ route: "/surfaces/widget/" }),
    })).rejects.toThrow(/route "\/surfaces\/widget\/" is claimed by both/u);
  });

  it("surfaces the contract's route diagnostics with document context", async () => {
    await expect(emit({
      documents: makeDocuments({ route: "/Guides/Getting-Started/" }),
    })).rejects.toThrow(/document "guides\/getting-started\.md".*not a canonical Docs route/u);
  });
});

describe("wtfmPlugin taprootDocs wiring", () => {
  function createMockEleventyConfig() {
    const config = {
      shortcodes: {},
      filters: {},
      globalData: {},
      events: {},
      collections: {},
      addShortcode(name, fn) { config.shortcodes[name] = fn; },
      addFilter(name, fn) { config.filters[name] = fn; },
      addGlobalData(name, value) { config.globalData[name] = value; },
      setLibrary() {},
      on(name, fn) { config.events[name] = fn; },
      addCollection(name, fn) { config.collections[name] = fn; },
    };
    return config;
  }

  it("registers the collection and emits through the eleventy.after hook", async () => {
    const workspace = mkdtempSync(join(tmpdir(), "taproot-docs-plugin-"));
    const cemPath = join(workspace, "custom-elements.json");
    writeFileSync(cemPath, JSON.stringify(makeCem()));
    writeFileSync(join(workspace, "overview.bin"), png);
    const outputDirectory = join(workspace, "_site");

    const config = createMockEleventyConfig();
    wtfmPlugin(config, {
      cemPath,
      taprootDocs: {
        source,
        navigation: [{ label: "Widget", resourceKey: "reference:widget" }],
        sourceDateEpoch: 1767225600,
      },
    });

    expect(typeof config.collections.taprootDocsDocuments).toBe("function");
    config.collections.taprootDocsDocuments({ getAll: () => [] });
    await config.events["eleventy.after"]({
      directories: { input: workspace, output: outputDirectory },
      outputMode: "fs",
      results: [
        { url: "/surfaces/widget/", content: "" },
        { url: "/surfaces/widget/help/", content: "" },
      ],
    });

    expect(existsSync(join(outputDirectory, "taproot-docs-manifest.json"))).toBe(true);
    expect(existsSync(join(outputDirectory, "help-manifest.json"))).toBe(true);
  });

  it("keeps the after hook artifact-free when the mode is off", async () => {
    const workspace = mkdtempSync(join(tmpdir(), "taproot-docs-plugin-off-"));
    const cemPath = join(workspace, "custom-elements.json");
    writeFileSync(cemPath, JSON.stringify(makeCem()));
    const outputDirectory = join(workspace, "_site");

    const config = createMockEleventyConfig();
    wtfmPlugin(config, { cemPath });
    expect(config.collections.taprootDocsDocuments).toBeUndefined();
    await config.events["eleventy.after"]({
      directories: { input: workspace, output: outputDirectory },
      outputMode: "fs",
      results: [
        { url: "/surfaces/widget/", content: "" },
        { url: "/surfaces/widget/help/", content: "" },
      ],
    });

    expect(existsSync(join(outputDirectory, "taproot-docs-manifest.json"))).toBe(false);
    expect(existsSync(join(outputDirectory, "help-manifest.json"))).toBe(true);
  });
});
