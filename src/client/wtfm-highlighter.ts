import type { HighlighterCore } from "shiki";

// ── Shared highlighter singleton ──────────────────────────────
//
// `initWtfmRuntime()` calls `setHighlighter()` once the Shiki
// core is ready.  Any component (e.g. `wtfm-code-block`) can
// import `getHighlighter()` or `whenHighlighterReady()` to
// access it — even if the component upgrades before the runtime
// has finished initialising.

let _highlighter: HighlighterCore | null = null;
let _theme = "";
const _waiters: Array<() => void> = [];

/**
 * Store the highlighter instance and resolve any pending waiters.
 * Called once from `initWtfmRuntime()`.
 */
export function setHighlighter(
  highlighter: HighlighterCore,
  theme: string,
): void {
  _highlighter = highlighter;
  _theme = theme;
  for (const resolve of _waiters) resolve();
  _waiters.length = 0;
}

/** Returns the highlighter if it has been initialised, otherwise `null`. */
export function getHighlighter(): HighlighterCore | null {
  return _highlighter;
}

/** Returns the current highlight theme name (e.g. `"espalier-light"`). */
export function getHighlightTheme(): string {
  return _theme;
}

/**
 * Returns a promise that resolves once the highlighter is available.
 * Resolves immediately if it has already been set.
 */
export function whenHighlighterReady(): Promise<void> {
  if (_highlighter) return Promise.resolve();
  return new Promise<void>((resolve) => _waiters.push(resolve));
}
