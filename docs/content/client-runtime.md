---
layout: layout.njk
title: Client runtime and code blocks
description: Initialize syntax highlighting, transform HTML examples, and understand the wtfm-code-block playground's safe operating boundary.
permalink: /client-runtime/
taprootDocs:
  key: concept:client-runtime
  kind: concept
  tags: [client, runtime]
---

## Runtime responsibilities {#runtime-responsibilities}

The optional client runtime enhances ordinary site pages. It initializes a
Shiki highlighter, exposes helpers used by demos, replaces supported code
blocks with highlighted output, and converts HTML fences into
`wtfm-code-block` elements. Documentation remains readable as static HTML when
a project chooses not to load these enhancements.

The runtime constructs no navigation or asset URLs. Server rendering and
Eleventy's path-prefix handling own those values.

## Initialize highlighting {#initialize-highlighting}

Import `initWtfmRuntime` from `@taprootio/wtfm/client/runtime`, provide a loaded
theme, and call it after the document is ready:

```js
import { initWtfmRuntime } from "@taprootio/wtfm/client/runtime";
import theme from "./theme.js";

await initWtfmRuntime({
  highlightTheme: theme.name,
  themes: [theme],
});
```

Bash, HTML, JavaScript, and XML are registered by default. Supply `langs` to
own the language set and `strings` when elements use `populate-from` labels.

## What wtfm-code-block does {#what-wtfm-code-block-does}

`wtfm-code-block` displays authored source and creates a live demo after the
code block. With CEM metadata and exactly one target component, it also shows
attribute controls and an event log. Multiple target instances intentionally
suppress those controls because a single value could not describe all of them.

The element prefers a base64-encoded `source` attribute produced by server
rendering. It also accepts a light-DOM template when the client runtime converts
an HTML fence. Code display always uses the original authored source rather
than serializing a component's mutated runtime DOM.

## Demo scripts and scope {#demo-scripts-and-scope}

Demo scripts receive `findByTagName` and `findById` helpers scoped to their demo
container. Scripts run synchronously when the demo is created so they can
capture elements before child lifecycle callbacks reparent or replace content.

Treat examples as trusted documentation source. `wtfm-code-block` is an
authoring tool, not a sandbox for untrusted HTML or JavaScript.

## Semantic artifacts stay noninteractive {#semantic-artifacts-stay-noninteractive}

Taproot Docs mode never emits the custom element, demo scripts, highlighted
wrappers, or runtime classes into semantic fragments. HTML examples become
plain fenced code through the [semantic renderer](/renderers/). A consumer can
show the example without executing it or importing WTFM's browser runtime.
