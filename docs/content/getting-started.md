---
layout: layout.njk
title: Installation and Eleventy setup
description: Install WTFM, connect a Custom Elements Manifest, and create the first portable Eleventy reference page.
permalink: /getting-started/
taprootDocs:
  key: guide:getting-started
  kind: guide
  tags: [eleventy, installation]
  redirectsFrom:
    - /installation/
---

## Install the packages {#install-the-packages}

Install WTFM beside Eleventy in the documentation workspace. WTFM expects the
component library to produce a Custom Elements Manifest; TypeScript is needed
only when the optional type extractor is part of the project.

```bash
npm install --save-dev @11ty/eleventy @taprootio/wtfm
```

The package declares Lit, TypeScript, and `@taprootio/espalier` as peer
dependencies because different consumers use different portions of the
toolchain. Install the peers used by the project rather than adding them solely
for an authored Markdown site.

## Register the plugin {#register-the-plugin}

Create an Eleventy configuration that points at the generated manifest. A
project installed from npm imports the package entry point:

```js
import wtfmPlugin from "@taprootio/wtfm";

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(wtfmPlugin, {
    cemPath: "custom-elements.json",
  });
}
```

This repository's own documentation intentionally imports
`src/server/eleventy-plugin.js` instead. That makes local builds exercise the
current working tree rather than a previously published WTFM release.

## Render a declaration {#render-a-declaration}

The plugin registers `renderDocs(name)`. A JavaScript template can ask WTFM for
the manifest-derived Markdown and pass it through the shared Markdown renderer:

```js
export default async function () {
  const markdown = await this.renderDocs("ExampleButton");
  return this.renderMarkdown(markdown);
}
```

The declaration name must match a declaration in the CEM or optional type
manifest. Unknown names warn and render no reference content, so validate the
manifest before treating a generated page as complete.

## Build the portable site {#build-the-portable-site}

Add an Eleventy command appropriate for the consuming repository and keep the
output directory ignored. A conventional command is:

```bash
npx eleventy
```

Open the output without a Taproot service. Links and assets should be either
document-relative or site-root-relative, with deployment prefixes applied once
through Eleventy's `HtmlBasePlugin` when the site is hosted below `/`.

Continue with [plugin configuration](/plugin/) for the full option surface or
[documents and surfaces](/authoring/) for the authoring model.
