## [0.15.0](https://github.com/taprootio/wtfm/compare/v0.14.0...v0.15.0) (2026-07-23)


### ⚠ Breaking changes

* the client runtime's optional peer dependency is now
  `@taprootio/espalier` (>=2.0.0) instead of the legacy GitHub Packages-only
  `@taprootio/taproot-controls`; `wtfm-code-block` imports `EspalierElementBase`
  from the public package (WTFM0009)

## [0.14.0](https://github.com/taprootio/wtfm/compare/v0.13.1...v0.14.0) (2026-07-23)


### Features

* stable heading anchors with `{#ExactId}` and `@helpAnchor` overrides;
  duplicate ids fail the build (WTFM0004)
* composed documentation surfaces — `@docSurface` tags, `renderSurfaceDocs`,
  `docSurfaces` data (WTFM0005)
* authored help documents conforming to the ESP0119 strip-to-bare contract via
  `renderHelpDocs` / `renderHelpDocument` (WTFM0006)
* versioned `help-manifest.json` output and the `wtfm-check-help-anchors`
  drift checker (WTFM0007)
* path-prefix portability through Eleventy `HtmlBasePlugin` for serving under
  `/help/` (WTFM0008)

## [0.13.1](https://github.com/taprootio/wtfm/compare/v0.13.0...v0.13.1) (2026-07-23)


### Features

* publish via npm Trusted Publishing — releases authenticate with a per-run
  GitHub Actions OIDC token instead of a stored registry token (WTFM0002)

## [0.13.0](https://github.com/taprootio/wtfm/compare/v0.12.3...v0.13.0) (2026-07-23)


### Features

* first public npm release — `@taprootio/wtfm` now publishes to the public
  npm registry instead of GitHub Packages, so it installs without GitHub auth
  (WTFM0001)

## [0.11.0](https://github.com/taprootio/wtfm/compare/v0.8.0...v0.11.0) (2026-03-07)


### Features

* use rolldown instead of rollup ([80a1972](https://github.com/taprootio/wtfm/commit/80a1972b7b21c9dc2c9f5ddf025ebdc8d76e09f2))

## [0.8.0](https://github.com/taprootio/wtfm/compare/v0.7.0...v0.8.0) (2026-02-25)


### Features

* manifest validation ([7695800](https://github.com/taprootio/wtfm/commit/769580011c948cac982e5a6813d5dc2e6b286d39))

## [0.7.0](https://github.com/taprootio/wtfm/compare/v0.6.1...v0.7.0) (2026-02-25)


### Features

* menu items can have a sort order ([59594c9](https://github.com/taprootio/wtfm/commit/59594c9ffb17bd83aad79b8d9198cd32337d0efa))

## [0.6.1](https://github.com/taprootio/wtfm/compare/v0.6.0...v0.6.1) (2026-02-25)


### Bug Fixes

* more resilient to various JSDoc/code structures ([57150ef](https://github.com/taprootio/wtfm/commit/57150ef4156342f17f236f81e724424dacdd261e))

## [0.6.0](https://github.com/taprootio/wtfm/compare/v0.5.0...v0.6.0) (2026-02-24)


### Features

* allow menu depth ([259b7ba](https://github.com/taprootio/wtfm/commit/259b7ba101ac218b020d0fc844e7746c2f1960a8))

