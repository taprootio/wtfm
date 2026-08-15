---
layout: layout.njk
title: Authored documents and reference surfaces
description: Decide what belongs in authored guidance, generated declaration references, composed surfaces, and separately authored help.
permalink: /authoring/
taprootDocs:
  key: concept:documents-and-surfaces
  kind: concept
  tags: [authoring, surfaces]
---

## Separate intent from inventory {#separate-intent-from-inventory}

Authored documents explain workflows, decisions, and troubleshooting. Manifest
references inventory a public API. WTFM keeps these inputs separate so a CEM
regeneration cannot overwrite product guidance and a prose edit cannot silently
change the declaration model.

Use normal Markdown pages for tutorials and concepts. Use `renderDocs` for one
declaration and `renderSurfaceDocs` when several custom elements form one
product-facing surface.

## Declare a documentation surface {#declare-a-documentation-surface}

The owning custom element carries a stable slug, title, and ordered member list
in CEM-backed JSDoc metadata:

```js
/**
 * @docSurface settings
 * @docSurfaceTitle Settings Surface
 * @docSurfaceParts settings-shell, settings-panel
 * @menuLabel Settings
 * @menuOrder 3
 */
export class SettingsShell extends HTMLElement {}
```

Register these tags with the CEM analyzer used by the component repository.
WTFM rejects duplicate surface slugs, missing members, ambiguous tag names,
invalid slugs, duplicate members, and incomplete ownership metadata.

## Render the reference route {#render-the-reference-route}

`docSurfaces` is ordered global data. A paginated JavaScript template can render
one reference page for each surface:

```js
export const data = {
  pagination: { data: "docSurfaces", size: 1, alias: "surface" },
  permalink: (data) => data.surface.referenceUrl,
};

export default async function (data) {
  const markdown = await this.renderSurfaceDocs(data.surface.slug);
  return this.renderMarkdown(markdown);
}
```

Member order follows `@docSurfaceParts`. Generated item anchors are namespaced
by member tag so similarly named attributes or slots do not collide.

## Keep help separately authored {#keep-help-separately-authored}

A surface help page should call `renderHelpDocs(slug, markdown)` with prose
written for the user's task. The restricted help renderer removes the need for
the consumer to interpret site wrappers or component markup. It accepts a
small semantic Markdown vocabulary and resolves relative links from the help
route.

Reference and help pages remain separate routes even when they share a surface
identity. Read [help documents and anchor validation](/help/) before another
application starts linking into the help content.

## Give artifact documents durable keys {#give-artifact-documents-durable-keys}

An authored Markdown page opts into artifact output with `taprootDocs` front
matter containing a `key` and `kind`. The key is not derived from its title,
route, or filename. Keep it unchanged when editorial details move; use
`redirectsFrom` when the public route changes.
