---
layout: layout.njk
title: Validation and troubleshooting
description: Gate WTFM builds, diagnose manifest and anchor failures, verify portable paths, and validate Taproot Docs output with the released contract.
permalink: /troubleshooting/
taprootDocs:
  key: guide:validation-and-troubleshooting
  kind: guide
  tags: [troubleshooting, validation]
---

## Validate inputs before rendering {#validate-inputs-before-rendering}

Run the component library's CEM generation and validation before Eleventy. A
missing `cemPath` only warns and supplies an empty manifest so authored-only
sites can build; a reference site should make an unexpectedly empty manifest a
separate failing gate.

When using WTFM's CEM analyzer plugin, register every documentation tag that
must survive into the manifest, including surface metadata, section selection,
menu metadata, and `helpAnchor`.

## Treat identity errors as compatibility failures {#treat-identity-errors-as-compatibility-failures}

Duplicate heading ids, surface slugs, resource keys, asset keys, routes, and
redirect sources fail deliberately. Do not fix these errors by deriving a key
from output order or silently appending a number. Choose an explicit durable
identifier, or add a redirect when only the route has changed.

Unknown surface members usually mean the CEM tag name is missing or ambiguous.
Unknown artifact navigation targets mean the page did not opt in, its key was
mistyped, or navigation changed before the document landed.

## Diagnose semantic fragment failures {#diagnose-semantic-fragment-failures}

Artifact-enabled Markdown is rendered from raw authored input. Remove raw HTML,
classes, styles, template syntax, and undeclared images. Use normal Markdown
links to a known resource route, HTTPS links for external sources, and explicit
canonical lowercase heading ids.

If a custom section renderer works on the site but fails an artifact build,
check its `semantic` branch. Interactive custom elements and class-dependent
markup belong only in site mode; semantic mode should return plain Markdown and
fenced code.

## Verify paths and prefixes {#verify-paths-and-prefixes}

WTFM produces site-root-relative component, breadcrumb, and asset URLs. Add
Eleventy's `HtmlBasePlugin` for a path-prefixed deployment and configure the
prefix once. Double prefixes usually mean a template or route builder added the
deployment path before Eleventy transformed the final HTML.

Test the ordinary site without its `taproot-docs/` subtree. Site pages must not
load fragments or semantic assets; that payload belongs to a publisher and
consumer, not the portable site runtime.

## Gate this repository {#gate-this-repository}

The WTFM documentation project has explicit local commands:

```bash
npm run docs:build
npm run docs:validate
npm run docs:test
```

`docs:build` writes both outputs to `docs/_site/`. `docs:validate` delegates to
the released `@taprootio/docs-artifact@1.0.1` directory validator. `docs:test`
builds twice, compares managed bytes, blocks network entry points, checks real
repository provenance and content, and crawls the ordinary static output after
removing the semantic payload.

For a complete repository change, also run `npm run build`, `npm test`, and
`npx @taprootio/trellis check`.

## Keep publishing separate {#keep-publishing-separate}

A green local artifact does not create a Taproot site, key, credential,
workflow, or deployment. Publication belongs to the consuming repository. The
producer's responsibility ends with deterministic bytes, complete provenance,
and a validation command that the consumer can repeat.
