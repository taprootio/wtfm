---
layout: layout.njk
title: Renderers and semantic output
description: Understand WTFM's section renderer contract, heading pipeline, interactive site output, and constrained semantic fragment boundary.
permalink: /renderers/
taprootDocs:
  key: reference:renderers
  kind: reference
  tags: [renderers, semantics]
---

## Section renderer contract {#section-renderer-contract}

A section renderer has a stable `key` and an asynchronous `render` function.
It receives one CEM declaration and resolved plugin options, then returns
Markdown. Built-ins cover examples, parameters, slots, attributes, properties,
methods, events, CSS parts, and CSS custom properties.

```js
{
  key: "custom-section",
  async render(declaration, options) {
    return "## Custom section\n\nDescribe the declaration.\n";
  },
}
```

Register custom renderers with `customRenderers` and include their keys in
`sections` or `@docSections`. A duplicate key intentionally replaces the
built-in implementation, so replacement renderers own compatibility with the
same inputs.

## One anchor pipeline {#one-anchor-pipeline}

Authored and generated headings use the same slug and duplicate detection.
Generated text becomes lowercase kebab-case. Generated item headings add their
section key, and composed surface references also add the member tag. Duplicate
ids fail rather than receiving order-dependent suffixes.

Pin an authored heading with an id-only attribute when another system treats
the fragment as a contract:

```md
## Title {#title}
```

Generated declarations may use `@helpAnchor` for an exact override. Register
that JSDoc tag in the CEM analyzer so it reaches WTFM.

## Site rendering mode {#site-rendering-mode}

The normal site renderer may emit layout-sensitive markup and converts HTML
example fences in component descriptions to `wtfm-code-block`. It applies the
configured path prefix to root-absolute demo URLs before encoding the example.
The browser runtime later turns the example into highlighted source and, when
appropriate, an interactive playground.

## Semantic rendering mode {#semantic-rendering-mode}

Taproot Docs fragments come from a dedicated semantic path, never from final
site HTML. It emits plain `pre` and `code` examples and a closed set of
headings, paragraphs, lists, tables, blockquotes, links, and declared images.

Internal document links become `data-resource-key` references and declared
images become `data-asset-key` references. Raw HTML, classes, styles, scripts,
unknown targets, unknown images, invalid attributes, and noncanonical anchors
fail. This boundary lets a consumer safely provide its own page shell.

## Design custom output for both modes {#design-custom-output-for-both-modes}

Inspect the renderer options before introducing interactive markup. A custom
renderer used by an artifact-enabled reference surface must return semantic
Markdown when `options.semantic` is true. Prefer plain headings, prose, lists,
tables, and fenced code; do not make meaning depend on a CSS class or custom
element.
