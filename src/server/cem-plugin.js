import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Tag names that WTFM uses for documentation.
 * These are the JSDoc tags that @wc-toolkit/jsdoc-tags extracts
 * into the Custom Elements Manifest.
 */
const DEFAULT_TAGS = [
  "docUrl",
  "menuLabel",
  "menuIcon",
  "menuGroup",
  "menuOrder",
  "docPageTitle",
  "docSections",
];

/**
 * Parses a JSDoc tag value into the `{ name, description }` format
 * used by `@wc-toolkit/jsdoc-tags`.
 *
 * The plugin splits values by the first whitespace:
 * - `"Box"` → `{ name: "Box", description: "" }`
 * - `"Date Picker"` → `{ name: "Date", description: "Picker" }`
 * - `"/components/button"` → `{ name: "/components/button", description: "" }`
 *
 * @param {string} value  Raw tag value from the JSDoc block.
 * @returns {{ name: string, description: string }}
 */
export function parseTagValue(value) {
  const trimmed = value.trim();
  const spaceIndex = trimmed.indexOf(" ");
  if (spaceIndex === -1) {
    return { name: trimmed, description: "" };
  }
  return {
    name: trimmed.slice(0, spaceIndex),
    description: trimmed.slice(spaceIndex + 1).trim(),
  };
}

/**
 * Extracts WTFM doc tags from JSDoc blocks in source text.
 *
 * Scans every `/** ... *​/` block in the file. Returns the parsed
 * tags from the **first** block that contains at least one of the
 * requested tag names.
 *
 * @param {string}   source    Full source text of the file.
 * @param {string[]} tagNames  Tag names to look for.
 * @returns {Record<string, { name: string, description: string }> | null}
 */
export function recoverTagsFromSource(source, tagNames) {
  const jsdocPattern = /\/\*\*[\s\S]*?\*\//g;
  let match;

  while ((match = jsdocPattern.exec(source)) !== null) {
    const block = match[0];
    const tags = {};

    for (const tag of tagNames) {
      // Match @tagName followed by its value until end of line.
      // The `m` flag makes `$` match each line boundary.
      const tagPattern = new RegExp(`@${tag}\\s+(.+?)\\s*$`, "m");
      const tagMatch = block.match(tagPattern);
      if (tagMatch) {
        // Strip any trailing JSDoc closing (`*/` or lone `*`).
        const raw = tagMatch[1].replace(/\s*\*\/?\s*$/, "").trim();
        if (raw) {
          tags[tag] = parseTagValue(raw);
        }
      }
    }

    if (Object.keys(tags).length > 0) {
      return tags;
    }
  }

  return null;
}

/**
 * Extracts `@example` blocks from a JSDoc comment.
 *
 * Each `@example` tag has an optional title on the same line and a
 * body that typically contains a fenced code block. The body extends
 * until the next `@example`, another `@tag`, or the end of the JSDoc
 * comment.
 *
 * Returns an array of `{ title, body }` objects. Both `title` and
 * `body` are trimmed strings. `title` may be empty if the tag has
 * no inline text.
 *
 * @param {string} source  Full source text of the file.
 * @returns {Array<{ title: string, body: string }>}
 */
export function extractExamples(source) {
  const jsdocPattern = /\/\*\*[\s\S]*?\*\//g;
  let match;
  const examples = [];

  while ((match = jsdocPattern.exec(source)) !== null) {
    const block = match[0];
    if (!block.includes("@example")) continue;

    // Strip the comment delimiters and leading ` * ` from each line
    // to get the raw content.
    const lines = block
      .replace(/^\/\*\*\s*/, "")
      .replace(/\s*\*\/\s*$/, "")
      .split("\n")
      .map((line) => line.replace(/^\s*\*\s?/, ""));

    let currentTitle = null;
    let currentBody = [];

    for (const line of lines) {
      if (line.startsWith("@example")) {
        // Flush previous example
        if (currentTitle !== null) {
          examples.push({
            title: currentTitle,
            body: currentBody.join("\n").trim(),
          });
        }
        currentTitle = line.slice("@example".length).trim();
        currentBody = [];
      } else if (currentTitle !== null) {
        // If we hit another JSDoc tag, flush and stop collecting
        if (/^@\w/.test(line)) {
          examples.push({
            title: currentTitle,
            body: currentBody.join("\n").trim(),
          });
          currentTitle = null;
          currentBody = [];
        } else {
          currentBody.push(line);
        }
      }
    }

    // Flush last example in the block
    if (currentTitle !== null) {
      examples.push({
        title: currentTitle,
        body: currentBody.join("\n").trim(),
      });
    }

    // Only process the first JSDoc block that has examples
    if (examples.length > 0) break;
  }

  return examples;
}

/**
 * CEM analyzer plugin that recovers WTFM doc tags lost when the
 * analyzer attaches a JSDoc block to the wrong declaration.
 *
 * ## The problem
 *
 * When a non-exported interface or type alias sits between a JSDoc
 * block and the `@customElement` class, the CEM analyzer attaches
 * the JSDoc (and all its custom tags) to the interface rather than
 * the class.  Because the interface is not exported it is silently
 * dropped from the manifest, taking the tags with it.
 *
 * ## How it works
 *
 * The plugin runs in `packageLinkPhase` — after every other plugin
 * has had a chance to annotate declarations.  For each custom-element
 * declaration that is still missing **all** doc tags, it reads the
 * original source file and parses the tags directly from the JSDoc.
 *
 * The recovered tags are written in the same `{ name, description }`
 * format that `@wc-toolkit/jsdoc-tags` produces, so downstream
 * tooling (e.g. WTFM data functions) works unchanged.
 *
 * ## `@example` extraction
 *
 * The plugin also extracts `@example` JSDoc blocks from source files
 * for all custom-element declarations (not just those missing tags).
 * Each `@example` block is parsed into a `{ title, body }` object
 * where `title` is the text on the `@example` line and `body` is
 * the content (typically a fenced code block). These are stored in
 * `decl.examples` as an array.
 *
 * ## Usage
 *
 * ```js
 * // custom-elements-manifest.config.js
 * import { jsDocTagsPlugin } from "@wc-toolkit/jsdoc-tags";
 * import { wtfmCemPlugin } from "@taprootio/wtfm/cem-plugin";
 *
 * export default {
 *   plugins: [
 *     jsDocTagsPlugin({ tags: { ... } }),
 *     wtfmCemPlugin(),
 *   ],
 * };
 * ```
 *
 * @param {object}   [options]
 * @param {string[]} [options.tags]  Tag names to recover.
 *   Defaults to the standard WTFM doc tags.
 * @returns {object} A CEM analyzer plugin.
 */
export default function wtfmCemPlugin(options = {}) {
  const tagNames = options.tags || DEFAULT_TAGS;

  return {
    name: "wtfm-cem-plugin",

    packageLinkPhase({ customElementsManifest }) {
      for (const mod of customElementsManifest.modules) {
        // Only look at custom-element class declarations.
        const ceDecls = (mod.declarations || []).filter(
          (d) => d.customElement || d.tagName,
        );

        for (const decl of ceDecls) {
          // ── Recover missing doc tags ──────────────────────────
          const needsTagRecovery = !tagNames.some((t) => decl[t]);

          let source;
          try {
            source = readFileSync(resolve(mod.path), "utf-8");
          } catch {
            continue;
          }

          if (needsTagRecovery) {
            const recovered = recoverTagsFromSource(source, tagNames);
            if (recovered) {
              Object.assign(decl, recovered);
            }
          }

          // ── Extract @example blocks ───────────────────────────
          if (!decl.examples || decl.examples.length === 0) {
            const examples = extractExamples(source);
            if (examples.length > 0) {
              decl.examples = examples;
            }
          }
        }
      }
    },
  };
}
