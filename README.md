# Write the F*in Manual

Tools for documentation driven development: an Eleventy plugin and supporting
tooling for documenting component libraries from their
[Custom Elements Manifest](https://github.com/webcomponents/custom-elements-manifest).

## Install

```bash
npm install --save-dev @taprootio/wtfm
```

## Entry points

- `@taprootio/wtfm` (or `/plugin`) — the Eleventy plugin.
- `/type-extractor` — TypeScript type extraction for manifest docs.
- `/renderers` — section renderers for manifest-driven doc pages.
- `/anchors` — the shared slug, explicit-id, and Markdown anchor helpers.
- `/urls` — root-absolute and document-relative URL helpers.
- `/surfaces` — surface collection and validation helpers.
- `/help-document` — the restricted semantic Markdown renderer for help pages.
- `/help-manifest`, `/check-help-anchors` — help link-index generation and
  consumer compatibility checks.
- `/data/components`, `/data/surfaces`, `/data/types`, `/data/manifest` — data
  helpers.
- `/bundler/manifest`, `/bundler/copy-assets` — bundler plugins.
- `/client/runtime`, `/client/code-block`, `/client/theme`, `/client/oklch` —
  client-side runtime pieces.
- `/cem-plugin` — Custom Elements Manifest analyzer plugin.
- `/validate-manifest` — manifest validation.

## Stable heading anchors

The Eleventy plugin gives every Markdown heading an `id`. Generated ids use
lowercase kebab-case (`CSS Properties` becomes `css-properties`). Generated
section/item headings use the same convention. Item ids include their section
to avoid cross-section collisions (`attributes--icon` and `slots--icon`).
Duplicate ids fail the build instead of being silently renumbered, because
published fragment URLs are a compatibility contract.

Pin an exact, case-sensitive id in authored Markdown with an id-only heading
attribute:

```md
## Page title {#Title}
```

Generated renderer items may instead carry `@helpAnchor Title` in their JSDoc.
Register the tag alongside the other WTFM tags when configuring
`@wc-toolkit/jsdoc-tags`:

```js
helpAnchor: {
  description: "Exact stable id for this documentation heading",
  type: "string",
  tagMapping: "helpAnchor",
},
```

When component docs are composed into a surface, generated ids are additionally
namespaced by custom-element tag (for example
`article-fields--attributes--title`). Explicit ids are never changed or
namespaced. CEM events without names are omitted with a build warning because
they cannot receive a stable semantic anchor.

## Composed documentation surfaces

A surface is an ordered group of custom elements with one reference page and
one separately authored help page. Declare its stable identity and members on
the owning custom element:

```js
/**
 * @docSurface settings
 * @docSurfaceTitle Settings Surface
 * @docSurfaceParts surface-shell, surface-panel
 * @menuLabel Settings
 * @menuOrder 3
 */
export class SurfaceShell extends HTMLElement {}
```

Register the same tags with `jsDocTagsPlugin` when generating the CEM:

```js
const surfaceTags = Object.fromEntries(
  ["docSurface", "docSurfaceTitle", "docSurfaceParts"].map((name) => [
    name,
    { type: "string", tagMapping: name },
  ]),
);
```

The plugin exposes validated surfaces as `docSurfaces` global data and provides
`renderSurfaceDocs(slug)` for the reference page. The default routes are
`/surfaces/<slug>/` and `/surfaces/<slug>/help/`; consumers can supply
`referenceUrlBuilder` and `helpUrlBuilder` plugin options to own those routes.
Use `/data/surfaces` when a separate pagination data file is preferable.

Surface member order follows `@docSurfaceParts`. Unknown or ambiguous member
tags, duplicate slugs or members, missing metadata, and invalid slugs stop the
build with an actionable error. Existing `@menuLabel`, `@menuIcon`,
`@menuGroup`, and `@menuOrder` metadata is reused for navigation.
Surface slugs and their derived URLs are permanent link targets; renaming one
after release is a breaking documentation change.

## Authored help documents

Reference docs and help prose are separate inputs. Use `renderHelpDocs` in a
surface help template, passing the surface slug and authored Markdown:

```js
export default async function (data) {
  return this.renderHelpDocs(data.surface.slug, data.helpMarkdown);
}
```

The equivalent standalone API is
`renderHelpDocument(markdown, { documentUrl })` from `/help-document`. Raw HTML
and MathJax are disabled. Output is limited to headings, paragraphs, emphasis,
lists, tables, code, blockquotes, images, links, horizontal rules, and line
breaks. Only heading `id`, link `href`, and image `src`/`alt` attributes are
emitted; wrappers, classes, styles, scripts, and framework attributes fail the
output contract.

Pin field-level anchors with exact, case-sensitive heading ids such as
`## Title {#Title}`. Relative links and images are resolved from the surface's
help route into root-absolute URLs before Eleventy applies its `pathPrefix`.

## Help manifest and anchor compatibility

After a filesystem build, the Eleventy plugin writes `help-manifest.json` at
the output root. Its versioned entries contain each surface slug, the final
path-prefixed reference and help URLs, and help heading ids in document order:

```json
{
  "schemaVersion": 1,
  "surfaces": [
    {
      "slug": "settings",
      "referenceUrl": "/help/surfaces/settings/",
      "helpUrl": "/help/surfaces/settings/help/",
      "anchors": ["settings-help", "Title"]
    }
  ]
}
```

Consumers keep their field-name contract in a separate versioned file:

```json
{
  "schemaVersion": 1,
  "surfaces": {
    "settings": ["Title"]
  }
}
```

Run the checker after the documentation build in consumer CI:

```bash
npx wtfm-check-help-anchors \
  _site/help-manifest.json expected-help-anchors.json
```

Missing surfaces or anchors fail. Extra built surfaces and anchors warn by
default because they may be intentional additions; pass `--strict` to make
them fail too. Duplicate, malformed, and schema-version-mismatched inputs
always fail.

## Path-prefixed Eleventy sites

WTFM emits internal page, breadcrumb, and bundler-manifest asset URLs as
root-absolute paths. Do not add the deployment prefix to those values. Let
Eleventy apply it once to final HTML with `HtmlBasePlugin`:

```js
import { HtmlBasePlugin } from "@11ty/eleventy";
import wtfmPlugin from "@taprootio/wtfm";

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(HtmlBasePlugin);
  eleventyConfig.addPlugin(wtfmPlugin, {
    cemPath: "custom-elements.json",
  });
}

export const config = {
  pathPrefix: "/help/",
};
```

This transforms `/components/button/` and `/dist/docs.js` to
`/help/components/button/` and `/help/dist/docs.js` in built HTML while leaving
external and fragment-only URLs unchanged. WTFM also applies the prefix to
root-absolute URLs inside demo HTML before that source is base64 encoded for
`<wtfm-code-block>`. Relative and external demo URLs remain unchanged.
`inlineSvg` reads and returns file content and therefore needs no URL prefix.
The WTFM client runtime constructs no asset or navigation URLs of its own.
