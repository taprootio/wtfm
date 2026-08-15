---
layout: layout.njk
title: Taproot Docs artifact mode
description: Emit and validate a deterministic schema-v1 semantic artifact beside the ordinary portable Eleventy site.
permalink: /artifact-mode/
taprootDocs:
  key: guide:taproot-docs-artifact
  kind: guide
  tags: [artifact, taproot]
  redirectsFrom:
    - from: /taproot-docs-artifact/
      status: 308
---

## Additive output {#additive-output}

When `taprootDocs` is present, the Eleventy build still writes the ordinary
site and additionally owns two entries at its output root:

```text
_site/
├── index.html
├── taproot-docs-manifest.json
└── taproot-docs/
    ├── fragments/
    └── assets/
```

Taproot packages the manifest and exactly the semantic files it declares. It
does not scrape rendered pages, CSS, or client JavaScript. A normal static host
can serve the entire output, while a publisher can select only the declared
artifact subset.

## Configure provenance and navigation {#configure-provenance-and-navigation}

Provenance is complete and explicit at the plugin boundary. A stable repository
id is authoritative; owner/name remains a human-readable locator. Revision,
ref, configuration hash, producer version, and source epoch make an artifact
inspectable and repeatable.

```js
taprootDocs: {
  source: {
    repositoryId: "1162327960",
    repository: "taprootio/wtfm",
    revision: process.env.WTFM_DOCS_REVISION,
    ref: "refs/heads/main",
  },
  navigation: [
    { label: "Start", children: [
      { label: "Installation", resourceKey: "guide:getting-started" },
    ] },
  ],
}
```

WTFM fails when a source field is missing, a navigation key does not resolve,
or deterministic time is unavailable. `ciEnvironment: true` may opt into the
documented GitHub Actions variables, but the stable repository id is never
guessed from a checkout.

## Opt in authored pages {#opt-in-authored-pages}

Each Markdown page supplies stable identity and a contract resource kind:

```yaml
taprootDocs:
  key: guide:getting-started
  kind: guide
  audiences: [developer]
  tags: [eleventy, installation]
  redirectsFrom: [/installation/]
```

Descriptions come from the block or page data. Audiences and tags are sorted
and unique. Declared raster assets use explicit keys and input-relative source
paths; undeclared images, missing files, unsafe paths, and byte/hash drift fail
the build.

## Build this repository's artifact {#build-this-repositorys-artifact}

The WTFM repository dogfoods its current source with one command:

```bash
npm run docs:build
```

The output and artifact directory is exactly `docs/_site/`. The build runner
binds the plugin to the checked-out 40-character Git revision and that commit's
epoch. It fails when tracked files have uncommitted changes so those source
bytes cannot silently disagree with the revision. It does not read credentials,
contact Taproot, create a site, or publish.

Use `npm run docs:build -- --allow-dirty` only for local editorial iteration.
That explicit opt-out permits an artifact whose content is not represented by
its recorded revision, so validate the layout locally but never publish those
bytes.

Validate the result with the released package contract:

```bash
npm run docs:validate
```

That command runs `taproot-docs-validate docs/_site`; both producer and future
consumer remain pinned to `@taprootio/docs-artifact@1.0.1`.
