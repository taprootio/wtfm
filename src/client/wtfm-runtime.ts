import { createHighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import type { HighlighterCore, ThemeRegistrationAny, LanguageRegistration } from "shiki";
import { setHighlighter } from "./wtfm-highlighter.js";

// ── Types ──────────────────────────────────────────────────────

export interface WtfmRuntimeOptions {
  /** Shiki theme to use (must match a loaded theme). */
  highlightTheme: string;

  /**
   * A Map of named strings used by `populate-from` attributes.
   * Elements with `populate-from="key"` will have their text
   * content set to the corresponding value.
   */
  strings?: Map<string, string>;

  /** Shiki language registrations to load. */
  langs: LanguageRegistration[][];

  /** Shiki theme registrations to load. */
  themes: ThemeRegistrationAny[];
}

// ── Global helpers ─────────────────────────────────────────────

declare global {
  interface Window {
    findByTagName: (tagName: string) => HTMLCollectionOf<Element> | undefined;
    findById: (id: string) => HTMLElement | null | undefined;
    htmlToNode: (html: string) => HTMLElement;
    getContrastingFromHex: (hex: string) => string;
  }
}

/**
 * Returns black or white depending on the perceived luminance of the hex color.
 */
export function getContrastingFromHex(hex: string): string {
  const r = parseInt(hex.substring(1, 3), 16);
  const g = parseInt(hex.substring(3, 5), 16);
  const b = parseInt(hex.substring(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#000000" : "#FFFFFF";
}

/**
 * Finds elements by tag name scoped to the nearest `.demo-wrapper`.
 * Designed to be called from inline `<script>` tags inside demos.
 */
export function findByTagName(
  tagName: string,
): HTMLCollectionOf<Element> | undefined {
  const scriptContext = document.currentScript?.closest("div.demo-wrapper");
  return scriptContext?.getElementsByTagName(tagName);
}

/**
 * Finds an element by ID scoped to the nearest `.demo-wrapper`.
 */
export function findById(id: string): HTMLElement | null | undefined {
  const scriptContext = document.currentScript?.closest("div.demo-wrapper");
  return scriptContext?.querySelector(`#${id}`);
}

/**
 * Parses an HTML string into a single DOM element.
 * Throws if the string produces zero or multiple root nodes.
 */
export function htmlToNode(html: string): HTMLElement {
  html = html.trim();
  const template = document.createElement("template");
  template.innerHTML = html;
  const nNodes = template.content.childNodes.length;
  if (nNodes !== 1) {
    throw new Error(
      `html parameter must represent a single node; got ${nNodes}. ` +
        "Note that leading or trailing spaces around an element in your " +
        'HTML, like " <img/> ", get parsed as text nodes neighbouring ' +
        "the element; call .trim() on your input to avoid this.",
    );
  }
  return template.content.firstChild as HTMLElement;
}

// ── Internal helpers ───────────────────────────────────────────

function unescapeHTML(escapedString: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(escapedString, "text/html");
  return doc.documentElement.textContent as string;
}

async function replacePreWithFormatted(
  highlighter: HighlighterCore,
  pre: HTMLPreElement,
  code: string,
  theme: string,
  lang: "html" | "js" | "xml",
) {
  pre.replaceWith(
    window.htmlToNode(
      highlighter.codeToHtml(code.trimEnd(), {
        lang: lang,
        theme: theme,
      }),
    ),
  );
}

// ── Init ───────────────────────────────────────────────────────

/**
 * Registers global helper functions and processes all code blocks
 * in the document. Call once from your DOMContentLoaded handler
 * **after** the page has loaded.
 *
 * Returns a promise that resolves when all code blocks have been
 * syntax-highlighted and all HTML demos have been injected.
 */
export async function initWtfmRuntime(
  options: WtfmRuntimeOptions,
): Promise<void> {
  const {
    highlightTheme,
    strings = new Map(),
    langs,
    themes,
  } = options;

  // Register globals so inline <script> tags in demos can use them.
  window.getContrastingFromHex = getContrastingFromHex;
  window.findByTagName = findByTagName;
  window.findById = findById;
  window.htmlToNode = htmlToNode;

  const highlighter = await createHighlighterCore({
    langs,
    themes,
    engine: createJavaScriptRegexEngine(),
  });

  setHighlighter(highlighter, highlightTheme);

  const promises: Array<Promise<void>> = [];

  // ── JS code blocks ─────────────────────────────────────────
  for (const jsCode of [...document.getElementsByClassName("language-js")]) {
    const thePre = jsCode.closest("pre");
    if (!thePre) {
      console.log("No pre...");
      return;
    }

    promises.push(
      replacePreWithFormatted(
        highlighter,
        thePre,
        unescapeHTML(jsCode.innerHTML),
        highlightTheme,
        "js",
      ),
    );
  }

  // ── XML code blocks ────────────────────────────────────────
  for (const xmlCode of [...document.getElementsByClassName("language-xml")]) {
    const thePre = xmlCode.closest("pre");
    if (!thePre) {
      console.log("No pre...");
      return;
    }

    promises.push(
      replacePreWithFormatted(
        highlighter,
        thePre,
        unescapeHTML(xmlCode.innerHTML),
        highlightTheme,
        "xml",
      ),
    );
  }

  // ── HTML code blocks → <wtfm-code-block> ───────────────────
  for (const htmlCode of [
    ...document.getElementsByClassName("language-html"),
  ]) {
    const unescaped = unescapeHTML(htmlCode.innerHTML);

    const thePre = htmlCode.closest("pre");
    if (!thePre) {
      console.log("No pre...");
      return;
    }

    const codeBlock = document.createElement("wtfm-code-block");
    const tpl = document.createElement("template");
    tpl.innerHTML = unescaped;
    codeBlock.appendChild(tpl);

    thePre.replaceWith(codeBlock);
  }

  await Promise.all(promises);

  // ── Populate strings ───────────────────────────────────────
  document.querySelectorAll("[populate-from]").forEach((el) => {
    const stringName = el?.getAttribute("populate-from") ?? "";
    (el as HTMLElement).innerText = strings.get(stringName) ?? "UNKNOWN";
  });
}
