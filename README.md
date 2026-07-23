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
- `/data/components`, `/data/types`, `/data/manifest` — data helpers.
- `/bundler/manifest`, `/bundler/copy-assets` — bundler plugins.
- `/client/runtime`, `/client/code-block`, `/client/theme`, `/client/oklch` —
  client-side runtime pieces.
- `/cem-plugin` — Custom Elements Manifest analyzer plugin.
- `/validate-manifest` — manifest validation.

## Stable heading anchors

The Eleventy plugin gives every Markdown heading an `id`. Generated ids use
lowercase kebab-case (`CSS Properties` becomes `css-properties`). Generated
section/item headings use the same convention. Duplicate ids fail the build
instead of being silently renumbered, because published fragment URLs are a
compatibility contract.

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

When component docs are composed into a surface, generated ids are namespaced
by custom-element tag (for example `article-fields--attributes`). Explicit ids
are never changed or namespaced.

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
external and fragment-only URLs unchanged. `inlineSvg` reads and returns file
content and therefore needs no URL prefix. The WTFM client runtime constructs
no asset or navigation URLs of its own.
