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
 * Extracts WTFM doc tags from a specific JSDoc block.
 *
 * @param {string}   block     The raw JSDoc comment text (`/** ... *​/`).
 * @param {string[]} tagNames  Tag names to look for.
 * @returns {Record<string, { name: string, description: string }> | null}
 */
export function extractTagsFromBlock(block, tagNames) {
  const tags = {};

  for (const tag of tagNames) {
    const tagPattern = new RegExp(`@${tag}\\s+(.+?)\\s*$`, "m");
    const tagMatch = block.match(tagPattern);
    if (tagMatch) {
      const raw = tagMatch[1].replace(/\s*\*\/?\s*$/, "").trim();
      if (raw) {
        tags[tag] = parseTagValue(raw);
      }
    }
  }

  return Object.keys(tags).length > 0 ? tags : null;
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
    const result = extractTagsFromBlock(match[0], tagNames);
    if (result) return result;
  }

  return null;
}

/**
 * Extracts `@example` blocks from a single JSDoc comment block.
 *
 * Each `@example` tag has an optional title on the same line and a
 * body that typically contains a fenced code block. The body extends
 * until the next `@example`, another `@tag`, or the end of the JSDoc
 * comment.
 *
 * @param {string} block  A single JSDoc comment (`/** ... *​/`).
 * @returns {Array<{ title: string, body: string }>}
 */
export function extractExamplesFromBlock(block) {
  if (!block.includes("@example")) return [];

  // Strip comment delimiters and the leading `*` plus all following
  // whitespace from each line. Using `\s*` (not `\s?`) ensures
  // blocks indented with multiple spaces are handled correctly.
  const lines = block
    .replace(/^\/\*\*\s*/, "")
    .replace(/\s*\*\/\s*$/, "")
    .split("\n")
    .map((line) => line.replace(/^\s*\*\s*/, ""));

  const examples = [];
  let currentTitle = null;
  let currentBody = [];
  let inFence = false;

  for (const line of lines) {
    // Track fenced code blocks so `@` inside code (e.g. @media,
    // @supports) is not mistaken for a JSDoc tag boundary.
    if (line.startsWith("```")) {
      inFence = !inFence;
    }

    if (!inFence && line.startsWith("@example")) {
      if (currentTitle !== null) {
        examples.push({
          title: currentTitle,
          body: currentBody.join("\n").trim(),
        });
      }
      currentTitle = line.slice("@example".length).trim();
      currentBody = [];
    } else if (currentTitle !== null) {
      if (!inFence && /^@\w/.test(line)) {
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

  if (currentTitle !== null) {
    examples.push({
      title: currentTitle,
      body: currentBody.join("\n").trim(),
    });
  }

  return examples;
}

/**
 * Find the last JSDoc block in `textBefore` that is directly adjacent
 * to the anchor point. "Adjacent" means the gap between the JSDoc's
 * closing `*​/` and the anchor contains only whitespace, decorator
 * lines (starting with `@`), and `export`/`default` keywords.
 *
 * @param {string} textBefore  Source text preceding the anchor.
 * @returns {string | null}  The adjacent JSDoc block, or null.
 */
function findAdjacentJsDoc(textBefore) {
  const jsdocPattern = /\/\*\*[\s\S]*?\*\//g;
  let lastBlock = null;
  let lastBlockEnd = -1;
  let blockMatch;

  while ((blockMatch = jsdocPattern.exec(textBefore)) !== null) {
    lastBlock = blockMatch[0];
    lastBlockEnd = blockMatch.index + blockMatch[0].length;
  }

  if (!lastBlock || lastBlockEnd < 0) return null;

  const gap = textBefore.slice(lastBlockEnd);
  const gapLines = gap
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const isAdjacent = gapLines.every(
    (line) =>
      line.startsWith("@") ||
      line === "export" ||
      line === "default" ||
      line === "export default",
  );

  return isAdjacent ? lastBlock : null;
}

/**
 * Extracts `@example` blocks from source text, scoped to a specific
 * declaration. Tries the following strategies in order:
 *
 * 1. **By class name** (`declName`): Finds `class DeclName` and checks
 *    for a directly adjacent JSDoc block.
 * 2. **By tag name** (`tagName`): Finds `@customElement("tagName")` and
 *    checks for a directly adjacent JSDoc block. This handles cases
 *    where `declName` is missing but the tag name is known.
 * 3. **Global fallback**: Scans all JSDoc blocks and returns examples
 *    from the first one that has any. Only used when neither `declName`
 *    nor `tagName` is provided, or neither was found in the source.
 *
 * When a declaration is found (by either name or tag), only its own
 * adjacent JSDoc is checked — this prevents misattribution.
 *
 * @param {string} source     Full source text of the file.
 * @param {string} [declName] The class name to match (e.g. "TaprootHero").
 * @param {string} [tagName]  The custom element tag name (e.g. "taproot-hero").
 * @returns {Array<{ title: string, body: string }>}
 */
export function extractExamples(source, declName, tagName) {
  // Strategy 1: Find `class DeclName` and look for adjacent JSDoc.
  if (declName) {
    const escapedName = declName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const classPattern = new RegExp(`class\\s+${escapedName}\\b`);
    const classMatch = classPattern.exec(source);

    if (classMatch) {
      const textBefore = source.slice(0, classMatch.index);
      const block = findAdjacentJsDoc(textBefore);
      if (block) return extractExamplesFromBlock(block);
      // Class found but no adjacent JSDoc — return empty.
      return [];
    }
  }

  // Strategy 2: Find `@customElement("tagName")` and look for adjacent JSDoc.
  if (tagName) {
    const escapedTag = tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const decoratorPattern = new RegExp(
      `@customElement\\(\\s*["']${escapedTag}["']\\s*\\)`,
    );
    const decoratorMatch = decoratorPattern.exec(source);

    if (decoratorMatch) {
      const textBefore = source.slice(0, decoratorMatch.index);
      const block = findAdjacentJsDoc(textBefore);
      if (block) return extractExamplesFromBlock(block);
      // Decorator found but no adjacent JSDoc — return empty.
      return [];
    }
  }

  // Strategy 3: Fall back to scanning all JSDoc blocks and returning
  // the first one that contains @example tags. Only used when neither
  // declName nor tagName is provided or found in the source.
  const jsdocPattern = /\/\*\*[\s\S]*?\*\//g;
  let blockMatch;

  while ((blockMatch = jsdocPattern.exec(source)) !== null) {
    const examples = extractExamplesFromBlock(blockMatch[0]);
    if (examples.length > 0) return examples;
  }

  return [];
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
 * Examples are scoped to the specific declaration — the plugin finds
 * the JSDoc block that precedes each class by name. This prevents
 * examples from being misattributed when a module contains multiple
 * custom-element declarations.
 *
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
      // Cache source file contents per module path to avoid redundant I/O
      // when a module contains multiple custom-element declarations.
      const sourceCache = new Map();

      for (const mod of customElementsManifest.modules) {
        const ceDecls = (mod.declarations || []).filter(
          (d) => d.customElement || d.tagName,
        );

        if (ceDecls.length === 0) continue;
        if (!mod.path) continue;

        // Skip I/O if every declaration already has doc tags and examples.
        const needsSource = ceDecls.some(
          (d) =>
            !tagNames.some((t) => d[t]) ||
            !d.examples ||
            d.examples.length === 0,
        );
        if (!needsSource) continue;

        // Read the source file once per module.
        let source;
        const filePath = resolve(mod.path);
        if (sourceCache.has(filePath)) {
          source = sourceCache.get(filePath);
        } else {
          try {
            source = readFileSync(filePath, "utf-8");
          } catch {
            sourceCache.set(filePath, null);
            continue;
          }
          sourceCache.set(filePath, source);
        }

        if (!source) continue;

        // Cache className → examples within a module. This avoids
        // redundant work if the same class name appears more than once
        // (unusual but possible). Each unique name still requires its
        // own extractExamples() call since extraction is class-scoped.
        const examplesCache = new Map();

        for (const decl of ceDecls) {
          // ── Recover missing doc tags ──────────────────────────
          const needsTagRecovery = !tagNames.some((t) => decl[t]);

          if (needsTagRecovery) {
            const recovered = recoverTagsFromSource(source, tagNames);
            if (recovered) {
              Object.assign(decl, recovered);
            }
          }

          // ── Extract @example blocks scoped to this declaration ─
          if (!decl.examples || decl.examples.length === 0) {
            // Use name + tagName as cache key to avoid collisions when
            // decl.name is missing. Skip caching entirely when both are
            // falsy to prevent misattribution across unnamed declarations.
            const cacheKey = decl.name
              ? `name:${decl.name}`
              : decl.tagName
                ? `tag:${decl.tagName}`
                : null;

            let examples;
            if (cacheKey && examplesCache.has(cacheKey)) {
              examples = examplesCache.get(cacheKey);
            } else {
              examples = extractExamples(source, decl.name, decl.tagName);
              if (cacheKey) examplesCache.set(cacheKey, examples);
            }

            if (examples.length > 0) {
              decl.examples = examples;
            }
          }
        }
      }
    },
  };
}
