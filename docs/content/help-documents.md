---
layout: layout.njk
title: Help documents, manifests, and anchors
description: Render lean surface help, publish its versioned link inventory, and detect field-level anchor drift in consumer CI.
permalink: /help/
taprootDocs:
  key: guide:help-and-anchors
  kind: guide
  tags: [anchors, help]
---

## Render authored help {#render-authored-help}

Reference pages describe what a component exposes. Help pages explain how a
person completes a task. Keep the help Markdown separate and pass it to the
surface-aware shortcode:

```js
export default function (data) {
  return this.renderHelpDocs(data.surface.slug, data.helpMarkdown);
}
```

The standalone equivalent is `renderHelpDocument(markdown, { documentUrl })`
from `@taprootio/wtfm/help-document`. It resolves relative links and images
from the owning help route.

## Respect the lean contract {#respect-the-lean-contract}

Help output permits semantic headings, paragraphs, emphasis, lists, tables,
code, blockquotes, images, links, horizontal rules, and line breaks. It does
not permit raw HTML, scripts, wrappers, classes, styles, framework attributes,
or MathJax. Only heading `id`, link `href`, and image `src` and `alt` survive.

This is a different boundary from the full site layout. A consuming application
can place the lean document in its own shell without importing the docs site's
CSS or runtime.

## Pin field-level anchors {#pin-field-level-anchors}

When an application links a form field to a help section, the anchor becomes a
compatibility contract. Use an exact, case-sensitive id:

```md
## Account name {#account-name}
```

Generated reference items use the shared anchor pipeline and may declare
`@helpAnchor`. Duplicate ids fail during rendering, including collisions
between authored overrides and generated headings.

## Read the help manifest {#read-the-help-manifest}

Every filesystem build writes `help-manifest.json` at the output root. Its
schema-v1 entries record each surface slug, final reference URL, final help URL,
and ordered help heading ids. An empty surface set produces a valid empty
manifest, which is what an authored-only project should expose.

The help manifest is ordinary build metadata, not the Taproot Docs artifact
manifest. It remains available even when artifact mode is disabled.

## Check consumer expectations {#check-consumer-expectations}

Keep the consuming application's expected surface and anchor inventory in a
separate versioned JSON file, then compare it after the documentation build:

```bash
npx wtfm-check-help-anchors \
  _site/help-manifest.json expected-help-anchors.json
```

Missing surfaces or anchors fail. Extra built entries warn by default; pass
`--strict` to treat additions as failures. Malformed inputs, duplicate values,
and schema-version mismatches always fail.
