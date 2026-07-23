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
- `/renderers` — section renderers for manifest-driven doc pages.
- `/data/components`, `/data/types`, `/data/manifest` — data helpers.
- `/bundler/manifest`, `/bundler/copy-assets` — bundler plugins.
- `/client/runtime`, `/client/code-block`, `/client/theme`, `/client/oklch` —
  client-side runtime pieces.
- `/cem-plugin` — Custom Elements Manifest analyzer plugin.
- `/validate-manifest` — manifest validation.
