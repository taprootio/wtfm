/**
 * Ambient type stub for @taprootio/taproot-controls.
 *
 * This package is an optional peer dependency and is not installed in CI.
 * The stub provides just enough surface for tsc to compile
 * wtfm-code-block.ts without the real package present.
 *
 * When the real package IS installed (e.g. by the consuming app) its
 * shipped .d.ts files take precedence via normal module resolution.
 */
declare module "@taprootio/taproot-controls" {
  import { LitElement, CSSResult } from "lit";

  export class EspalierElementBase extends LitElement {
    static styles: CSSResult[];
  }
}
