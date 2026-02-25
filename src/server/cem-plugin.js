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
          // Skip declarations that already have at least one doc tag.
          if (tagNames.some((t) => decl[t])) continue;

          // Try to read the original source file.
          let source;
          try {
            source = readFileSync(resolve(mod.path), "utf-8");
          } catch {
            continue;
          }

          const recovered = recoverTagsFromSource(source, tagNames);
          if (recovered) {
            Object.assign(decl, recovered);
          }
        }
      }
    },
  };
}
