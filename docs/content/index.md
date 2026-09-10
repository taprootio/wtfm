---
layout: layout.njk
title: WTFM documentation
description: Build portable component-library documentation from Custom Elements Manifest data, authored guidance, and stable semantic contracts.
permalink: /
taprootDocs:
  key: concept:overview
  kind: concept
  tags: [documentation, overview]
---

## What WTFM does {#what-wtfm-does}

WTFM is documentation tooling for component libraries that describe their
public API with a Custom Elements Manifest. Its Eleventy plugin turns that
manifest into reference pages, combines related elements into documentation
surfaces, renders authored guidance, and keeps headings and links stable enough
to become compatibility contracts.

The ordinary result is static HTML that can be copied to any static host. An
optional build mode also writes a schema-v1 Taproot Docs artifact for a semantic
consumer. The artifact is additive: the static site does not read it and
Taproot does not scrape the final site HTML.

## Choose a path {#choose-a-path}

- Start with [installation and Eleventy setup](/getting-started/) when adding
  WTFM to a project.
- Use the [plugin configuration reference](/plugin/) when you need custom
  sections, routes, source links, or artifact options.
- Read [documents and surfaces](/authoring/) before choosing which material is
  authored and which is derived from a manifest.
- Enable the [Taproot Docs artifact](/artifact-mode/) only when a semantic
  consumer needs it.
- Keep [validation and troubleshooting](/troubleshooting/) in the build gate.

## Two outputs, one source {#two-outputs-one-source}

The site renderer and semantic renderer share identities, headings, and
manifest data, but they have different jobs. Site pages may include layout,
styles, and interactive examples. Semantic fragments use a closed HTML subset
and plain code examples so a consumer can safely place them in its own shell.

That separation is deliberate. It makes the documentation portable while
allowing the same repository content to participate in a stricter artifact
contract.

## Stability is authored {#stability-is-authored}

Routes, surface slugs, resource keys, and explicit heading ids should be
treated as public identifiers. Choose them for durability, add redirects when
routes move, and use the anchor checker when another application links to
field-level help. WTFM fails duplicate or malformed identities instead of
silently inventing replacements.


## Follow the published source {#follow-the-published-source}

The public WTFM documentation at [wtfm.taproot.io](https://wtfm.taproot.io/)
is built from this repository's `main` branch. Each page's source link points
to the exact published Git revision, so you can compare the guidance with the
code that produced it.

Documentation updates publish separately from the WTFM npm library. A merge
can update this site without changing the library version; use your installed
package version when checking whether an API is available in your project.
