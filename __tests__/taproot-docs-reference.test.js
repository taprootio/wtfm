import { describe, it, expect } from "vitest";
import { collectSurfaces } from "../src/server/surfaces.js";
import { defaultRenderers } from "../src/server/section-renderers/index.js";
import {
  collectSurfaceResources,
  composeSurfaceReferenceMarkdown,
} from "../src/server/taproot-docs/reference.js";
import { renderDocsFragment } from "../src/server/taproot-docs/fragments.js";

/** A CEM whose surface exercises attributes, description demos, and examples. */
function makeCem({ description = "A widget that does widget things.\n\nMore detail." } = {}) {
  return {
    modules: [
      {
        path: "src/components/test-widget.ts",
        declarations: [
          {
            name: "TestWidget",
            tagName: "test-widget",
            description,
            docSurface: { name: "widget" },
            docSurfaceTitle: { name: "Widget surface" },
            docSurfaceParts: { name: "test-widget" },
            attributes: [
              {
                name: "label",
                type: { text: "string" },
                default: '""',
                description: "Label text with a demo:\n\n```html\n<test-widget label=\"Hi\"></test-widget>\n```\n",
              },
            ],
            examples: [
              { title: "Basic use", body: "```html\n<test-widget></test-widget>\n```" },
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

/**
 * A slim renderDeclaration equivalent for tests: description (fences kept in
 * semantic mode) plus every default section renderer with the same merged
 * options the plugin passes.
 */
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

describe("collectSurfaceResources", () => {
  it("builds deterministic reference descriptors from the surface model", () => {
    const cem = makeCem();
    const surfaces = collectSurfaces(cem);
    const [resource] = collectSurfaceResources(surfaces, cem);
    expect(resource).toMatchObject({
      key: "reference:widget",
      kind: "reference",
      audiences: ["developer"],
      tags: [],
      title: "Widget surface",
      description: "A widget that does widget things.",
      route: "/surfaces/widget/",
      sourcePath: "src/components/test-widget.ts",
    });
  });

  it("fails closed when the defining component lacks a description", () => {
    const cem = makeCem({ description: "" });
    const surfaces = collectSurfaces(cem);
    expect(() => collectSurfaceResources(surfaces, cem))
      .toThrow(/needs a class description on <test-widget>/u);
  });

  it("fails closed when the defining module has no path", () => {
    const cem = makeCem();
    delete cem.modules[0].path;
    const surfaces = collectSurfaces(cem);
    expect(() => collectSurfaceResources(surfaces, cem))
      .toThrow(/no module path/u);
  });
});

describe("composeSurfaceReferenceMarkdown", () => {
  it("composes semantic markdown that passes the constrained fragment pipeline", async () => {
    const cem = makeCem();
    const [surface] = collectSurfaces(cem);
    const markdown = await composeSurfaceReferenceMarkdown(surface, {
      renderDeclaration: makeRenderDeclaration(),
    });

    expect(markdown).not.toContain("wtfm-code-block");
    expect(markdown).not.toContain('<div class="doc-section">');

    const { html, headings } = renderDocsFragment(markdown, {
      context: 'surface "widget"',
      resolveRouteLink: () => null,
      assetsBySource: new Map(),
    });

    expect(html).toContain('<h2 id="test-widget"><code>&lt;test-widget&gt;</code></h2>');
    expect(html).toContain('<h3 id="test-widget-attributes">Attributes</h3>');
    expect(html).toContain('<h4 id="test-widget-attributes-label">label</h4>');
    expect(html).toContain('<h3 id="test-widget-examples">Examples</h3>');
    expect(html).toContain('<h4 id="test-widget-examples-basic-use">Basic use</h4>');
    expect(html).toContain('<pre><code data-language="html">');
    expect(html).not.toContain("class=");
    expect(headings.map((heading) => heading.id)).toEqual([
      "test-widget",
      "test-widget-examples",
      "test-widget-examples-basic-use",
      "test-widget-attributes",
      "test-widget-attributes-label",
    ]);
  });

  it("keeps the interactive composition unchanged outside semantic mode", async () => {
    const cem = makeCem();
    const [surface] = collectSurfaces(cem);
    const renderDeclaration = makeRenderDeclaration();
    let richMarkdown = "";
    for (const member of surface.members) {
      richMarkdown += await renderDeclaration(member, {
        anchorPrefix: member.tagName,
        headingOffset: 1,
        includeHeader: false,
      });
    }
    expect(richMarkdown).toContain("<wtfm-code-block");
    expect(richMarkdown).toContain('<div class="doc-section">');
    expect(richMarkdown).toContain("{#test-widget--attributes}");
  });
});
