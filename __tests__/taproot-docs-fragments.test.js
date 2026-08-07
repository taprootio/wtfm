import { describe, it, expect } from "vitest";
import { renderDocsFragment } from "../src/server/taproot-docs/fragments.js";

const routes = new Map([
  ["/guides/getting-started/", { resourceKey: "guide:getting-started" }],
  ["/reference/button/", { resourceKey: "reference:button" }],
]);

const assets = new Map([
  ["assets/overview.png", { key: "diagram-overview", width: 640, height: 480 }],
]);

function render(markdown, overrides = {}) {
  return renderDocsFragment(markdown, {
    context: 'document "guides/example.md"',
    resolveRouteLink: (route) => routes.get(route) ?? null,
    assetsBySource: assets,
    ...overrides,
  });
}

describe("renderDocsFragment", () => {
  it("renders semantic markup and collects the ordered heading inventory", () => {
    const { html, headings } = render(
      "## Install\n\nRun the thing.\n\n### Verify  it\n\nDone.\n",
    );
    expect(html).toContain('<h2 id="install">Install</h2>');
    expect(html).toContain('<h3 id="verify-it">Verify  it</h3>');
    expect(headings).toEqual([
      { id: "install", text: "Install", level: 2 },
      { id: "verify-it", text: "Verify it", level: 3 },
    ]);
  });

  it("honors contract-conformant explicit anchor overrides", () => {
    const { html, headings } = render("## Install {#custom-install}\n");
    expect(html).toContain('<h2 id="custom-install">Install</h2>');
    expect(headings[0].id).toBe("custom-install");
  });

  it.each([
    ["## Install {#Install-Now}", /heading id "Install-Now" is not canonical/u],
    ["## Ω limits", /heading id "ω-limits" is not canonical/u],
  ])("rejects non-canonical heading ids with authoring guidance (%s)", (markdown, message) => {
    expect(() => render(`${markdown}\n`)).toThrow(message);
  });

  it("rejects duplicate heading ids with document context", () => {
    expect(() => render("## Install\n\n## Install\n")).toThrow(/guides\/example\.md/u);
  });

  it("rejects an h1 in the fragment body", () => {
    expect(() => render("# Title\n")).toThrow(/may not contain an h1/u);
  });

  it.each([
    ["<div>block</div>\n", /raw HTML \(<div>block<\/div>\)/u],
    ["Inline <span>markup</span>.\n", /raw HTML \(<span>\)/u],
  ])("rejects raw HTML (%s)", (markdown, message) => {
    expect(() => render(markdown)).toThrow(message);
  });

  it("translates internal route links to data-resource-key markup", () => {
    const { html } = render(
      "See [the guide](/guides/getting-started/) and [buttons](/reference/button/#usage).\n",
    );
    expect(html).toContain('<a data-resource-key="guide:getting-started">the guide</a>');
    expect(html).toContain(
      '<a data-resource-key="reference:button" data-heading-id="usage">buttons</a>',
    );
    expect(html).not.toContain("href=\"/");
  });

  it("keeps local heading links and https links as href", () => {
    const { html } = render("Jump to [install](#install) or [npm](https://npmjs.com/).\n");
    expect(html).toContain('<a href="#install">install</a>');
    expect(html).toContain('<a href="https://npmjs.com/">npm</a>');
  });

  it.each([
    ["[x](/missing/route/)", /does not resolve to a Taproot Docs resource route/u],
    ["[x](../relative.md)", /not a supported fragment destination/u],
    ["[x](http://insecure.example/)", /not a supported fragment destination/u],
    ["[x](mailto:docs@example.com)", /not a supported fragment destination/u],
  ])("rejects unsupported link destinations (%s)", (markdown, message) => {
    expect(() => render(`${markdown}\n`)).toThrow(message);
  });

  it("resolves images to declared assets and never emits src", () => {
    const { html } = render("![System overview](./assets/overview.png)\n");
    expect(html).toContain(
      '<img data-asset-key="diagram-overview" alt="System overview" width="640" height="480">',
    );
    expect(html).not.toContain("src=");
  });

  it("rejects images that are not declared assets", () => {
    expect(() => render("![x](assets/unknown.png)\n")).toThrow(/not a declared artifact asset/u);
  });

  it("emits data-language code fences with escaped content and no classes", () => {
    const { html } = render("```TS\nconst a = \"<b>\";\n```\n");
    expect(html).toContain('<pre><code data-language="ts">const a = &quot;&lt;b&gt;&quot;;\n</code></pre>');
    expect(html).not.toContain("class=");
  });

  it("renders bare fences without a language attribute and rejects invalid info strings", () => {
    expect(render("```\nplain\n```\n").html).toContain("<pre><code>plain\n</code></pre>");
    expect(() => render("```c++\nint x;\n```\n")).toThrow(/code fence language "c\+\+"/u);
  });

  it("drops authored classes (wtfm-wide attrs policy) and never emits them", () => {
    const { html } = render("A paragraph. {.fancy}\n");
    expect(html).not.toContain("class=");
    expect(html).not.toContain("{.fancy}");
  });

  it("rejects explicit ids on non-heading elements", () => {
    expect(() => render("A paragraph. {#para-id}\n")).toThrow(/<p> may not carry the "id" attribute/u);
  });

  it("strips presentational table alignment styles", () => {
    const { html } = render("| Left | Right |\n|:-----|------:|\n| a | b |\n");
    expect(html).toContain("<table>");
    expect(html).not.toContain("style=");
  });

  it("renders strikethrough as the semantic <s> element", () => {
    expect(render("~~gone~~\n").html).toContain("<s>gone</s>");
  });

  it("produces byte-identical output for identical input", () => {
    const markdown = "## Install\n\nText with [a link](/guides/getting-started/).\n";
    expect(render(markdown)).toEqual(render(markdown));
  });
});
