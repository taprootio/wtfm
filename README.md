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

## Taproot Docs artifacts

Opting into the additive Taproot Docs build mode makes the same Eleventy build
emit the `@taprootio/docs-artifact` payload beside its ordinary portable
output: `_site/taproot-docs-manifest.json` plus the manifest-listed semantic
fragments and raster assets under `_site/taproot-docs/`. The ordinary `_site`
output is byte-for-byte unaffected — Taproot ingests only the manifest and the
files it lists, never the rendered site HTML.

```js
eleventyConfig.addPlugin(wtfmPlugin, {
  cemPath: "custom-elements.json",
  taprootDocs: {
    source: {
      repositoryId: "R_kgDOexample", // GitHub's stable repository id
      repository: "taprootio/example-docs",
      revision: "<40-hex commit>",
      ref: "refs/heads/main",
    },
    // Or set ciEnvironment: true to fall back to GITHUB_REPOSITORY_ID,
    // GITHUB_REPOSITORY, GITHUB_SHA, and GITHUB_REF inside Actions.
    navigation: [
      { label: "Guides", children: [{ label: "Getting started", resourceKey: "guide:getting-started" }] },
      { label: "Widget", resourceKey: "reference:widget" },
    ],
  },
});
```

Authored Markdown pages opt in per document with explicit identity — keys are
never derived from routes, titles, or file paths, so pages can move without
changing what Taproot considers "the same document":

```yaml
---
title: Getting started
description: Install the library and render the widget.
taprootDocs:
  key: guide:getting-started
  kind: guide
  audiences: [developer]
  redirectsFrom: [/old-start/]
  assets:
    - key: diagram-overview
      source: assets/overview.png
---
```

Every documentation surface additionally becomes a `reference:<slug>` resource
composed through the same section renderers in their semantic mode.

The fragment boundary is intentional: fragments are rendered by a dedicated
constrained pipeline (headings start at `h2` with canonical lowercase ids,
cross-document links become `data-resource-key` markup, images resolve to
declared assets via `data-asset-key`, demos are plain fenced code), and
rendered `_site` HTML is never treated as part of the contract. Raw HTML,
unknown links or images, non-canonical explicit anchors, undeclared assets,
duplicate identities, unsafe paths, and missing provenance all fail the build.
Provenance (`source.*`, `configurationSha256`, `sourceDateEpoch`) is explicit
or CI-provided; the build fails rather than guessing, and falls back to the
HEAD commit timestamp only for `sourceDateEpoch`. The assembled manifest is
serialized and asserted through `@taprootio/docs-artifact`, and the written
artifact is re-validated with `validateArtifactDirectory` before the build is
allowed to succeed — `npm run test:taproot-docs` runs the fixture-backed
conformance suite in CI. Authored documents are plain Markdown: template
syntax inside an opted-in body is outside the artifact contract.

`_site/taproot-docs/` and `_site/taproot-docs-manifest.json` are emitter-owned
and reset on every build; the build fails closed if that subtree contains
anything the emitter did not write, so site content can never be silently
deleted from the deployed output.
