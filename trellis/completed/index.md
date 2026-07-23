# Completed tasks

Generated from `completed/tasks/`. Do not hand-edit between the markers — close
a task and regenerate (`npx @taprootio/trellis generate`).

<!-- BEGIN GENERATED:COMPLETED -->
| ID | Title | Summary | Completed |
| --- | --- | --- | --- |
| [WTFM0001](tasks/WTFM0001.md) | Publish @taprootio/wtfm to the public npm registry | Move publishing from the private GitHub Packages registry to the public npm registry so @taprootio/wtfm installs without GitHub auth; ship 0.13.0 as the first public release. | 2026-07-23 |
| [WTFM0002](tasks/WTFM0002.md) | Switch npm publishing to Trusted Publishing (OIDC) | Configure npm Trusted Publishing so the publish workflow authenticates via GitHub Actions OIDC, then retire the short-lived NPM_TOKEN secret entirely. | 2026-07-23 |
| [WTFM0004](tasks/WTFM0004.md) | Emit stable heading anchors across rendered docs | Give every rendered heading a deterministic, collision-safe id — namespaced on composed surfaces and exactly overridable from Markdown or CEM metadata — so reference docs remain stable and authored help anchors can match Espalier field-names. | 2026-07-23 |
| [WTFM0005](tasks/WTFM0005.md) | Surface pages — one doc page per unit of display | Let one component define a named surface and its ordered reusable member components, then generate pagination data and a namespaced composed reference page for that unit of display while keeping component pages unchanged. | 2026-07-23 |
| [WTFM0006](tasks/WTFM0006.md) | Help-document output mode conforming to ESP0119 strip-to-bare | A lean renderer for separately authored surface-help Markdown whose output survives Espalier ESP0119 normalization — semantic elements and exact field-name anchors only, with document-relative URLs made safe for injection into the editor page. | 2026-07-23 |
| [WTFM0007](tasks/WTFM0007.md) | Help manifest and anchor drift check | Emit a machine-readable help manifest (surface → URLs → anchor list) at build time and ship a check command that fails when a consumer-supplied expected-anchor list no longer matches the built docs — turning silent anchor drift into a CI failure. | 2026-07-23 |
| [WTFM0008](tasks/WTFM0008.md) | Path-prefix portability for generated sites | Make wtfm's root-absolute page, breadcrumb, asset, and help-document URLs compose through Eleventy's HtmlBasePlugin with pathPrefix, verified by a real site built and inspected under /help/. | 2026-07-23 |
<!-- END GENERATED:COMPLETED -->
