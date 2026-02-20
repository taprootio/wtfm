/**
 * Creates a Shiki ThemeRegistration from a simple color token map.
 *
 * This is a WTFM utility — it owns the TextMate scope mappings
 * but has no knowledge of any specific design system. Consumers
 * provide colors as hex or oklch() strings; oklch values are
 * converted to hex automatically.
 */

import type { ThemeRegistration } from "shiki";
import { normalizeToHex } from "./oklch-to-hex.js";

/**
 * Color tokens accepted by {@link createShikiTheme}.
 * Values can be hex (`#RRGGBB`) or oklch (`oklch(0.5 0.12 216)`).
 */
export interface ShikiColorTokens {
  /** Code block background. */
  background: string;
  /** Default text foreground. */
  foreground: string;
  /** Comments (rendered italic). */
  comment: string;
  /** String literals. */
  string: string;
  /** Language keywords (function, const, if, etc.). */
  keyword: string;
  /** Function and method names. */
  function: string;
  /** Numeric literals. */
  number: string;
  /** Operators (+, -, &&, etc.). */
  operator: string;
  /** Type names and classes. */
  type: string;
  /** HTML/XML tag names. */
  tag: string;
  /** HTML/XML attribute names. */
  attribute: string;
  /** Punctuation (brackets, semicolons, commas). */
  punctuation: string;
  /** Language constants (true, false, null). */
  constant: string;
}

/**
 * Build a Shiki {@link ThemeRegistration} from a color token map.
 *
 * @param name  - Theme identifier (e.g., `"my-theme-light"`)
 * @param type  - `"light"` or `"dark"`
 * @param colors - Color tokens; oklch() values are auto-converted to hex
 * @returns A ready-to-use Shiki theme registration
 */
export function createShikiTheme(
  name: string,
  type: "light" | "dark",
  colors: ShikiColorTokens,
): ThemeRegistration {
  const bg = normalizeToHex(colors.background);
  const fg = normalizeToHex(colors.foreground);
  const comment = normalizeToHex(colors.comment);
  const string = normalizeToHex(colors.string);
  const keyword = normalizeToHex(colors.keyword);
  const fn = normalizeToHex(colors.function);
  const number = normalizeToHex(colors.number);
  const operator = normalizeToHex(colors.operator);
  const typeColor = normalizeToHex(colors.type);
  const tag = normalizeToHex(colors.tag);
  const attribute = normalizeToHex(colors.attribute);
  const punctuation = normalizeToHex(colors.punctuation);
  const constant = normalizeToHex(colors.constant);

  return {
    name,
    displayName: name,
    type,
    fg,
    bg,
    colors: {
      "editor.background": bg,
      "editor.foreground": fg,
    },
    tokenColors: [
      // Default foreground
      {
        settings: {
          foreground: fg,
        },
      },
      // Comments
      {
        scope: "comment",
        settings: {
          fontStyle: "italic",
          foreground: comment,
        },
      },
      // Strings
      {
        scope: "string",
        settings: {
          foreground: string,
        },
      },
      // Keywords
      {
        scope: ["keyword", "storage.type", "storage.modifier"],
        settings: {
          foreground: keyword,
        },
      },
      // Functions
      {
        scope: ["entity.name.function", "support.function"],
        settings: {
          foreground: fn,
        },
      },
      // Numbers
      {
        scope: "constant.numeric",
        settings: {
          foreground: number,
        },
      },
      // Operators
      {
        scope: "keyword.operator",
        settings: {
          foreground: operator,
        },
      },
      // Types and classes
      {
        scope: ["entity.name.type", "entity.name.class", "support.type"],
        settings: {
          foreground: typeColor,
        },
      },
      // HTML/XML tags
      {
        scope: "entity.name.tag",
        settings: {
          foreground: tag,
        },
      },
      // HTML/XML attributes
      {
        scope: "entity.other.attribute-name",
        settings: {
          foreground: attribute,
        },
      },
      // Punctuation
      {
        scope: "punctuation",
        settings: {
          foreground: punctuation,
        },
      },
      // Language constants (true, false, null) and built-in variables
      {
        scope: ["constant.language", "variable.language"],
        settings: {
          foreground: constant,
        },
      },
    ],
  };
}
