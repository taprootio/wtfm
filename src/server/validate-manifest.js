import { readFileSync } from "fs";

/**
 * Default tags that every documented custom element should have.
 * menuLabel and menuIcon are intentionally excluded — sub-components
 * linked from a parent page don't need their own menu entries.
 * @type {string[]}
 */
const DEFAULT_REQUIRED_TAGS = [
  "docUrl",
  "docPageTitle",
  "menuGroup",
];

/**
 * Validates a Custom Elements Manifest to ensure all custom element
 * declarations have required JSDoc tags.
 *
 * @param {string} cemPath - Path to custom-elements.json
 * @param {object} [options]
 * @param {string[]} [options.requiredTags] - JSDoc tags that must be present
 *   (defaults to docUrl, docPageTitle, menuGroup)
 * @param {string[]} [options.skipTags] - Custom element tag names to skip
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateManifest(cemPath, options = {}) {
  const {
    requiredTags = DEFAULT_REQUIRED_TAGS,
    skipTags = [],
  } = options;

  /** @type {object} */
  let cem;
  try {
    cem = JSON.parse(readFileSync(cemPath, "utf-8"));
  } catch (e) {
    return {
      valid: false,
      errors: [`Failed to read CEM at ${cemPath}: ${e.message}`],
    };
  }

  /** @type {string[]} */
  const errors = [];

  for (const mod of cem.modules ?? []) {
    for (const decl of mod.declarations ?? []) {
      if (!decl.tagName) continue;
      if (skipTags.includes(decl.tagName)) continue;

      const missing = requiredTags.filter((tag) => !decl[tag]);
      if (missing.length > 0) {
        errors.push(
          `<${decl.tagName}> (${decl.name}): missing @${missing.join(", @")}`,
        );
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * CLI entry point. Reads CEM path and options from process.argv.
 *
 * Usage:
 *   node -e "import('@taprootio/wtfm/validate-manifest').then(m => m.runCli())" \
 *     -- custom-elements.json --skip esp-picker-item,esp-image-preview
 */
export function runCli() {
  const args = process.argv.slice(2);

  // Find CEM path (first non-flag argument)
  let cemPath = null;
  let skipTags = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--" ) continue;
    if (args[i] === "--skip" && i + 1 < args.length) {
      skipTags = args[++i].split(",").map((s) => s.trim());
    } else if (!args[i].startsWith("--")) {
      cemPath = args[i];
    }
  }

  if (!cemPath) {
    console.error(
      "Usage: validate-manifest <path-to-cem.json> [--skip tag1,tag2]",
    );
    process.exit(1);
  }

  const result = validateManifest(cemPath, { skipTags });

  if (!result.valid) {
    console.error("✗ Manifest validation failed:\n");
    for (const err of result.errors) {
      console.error(`  • ${err}`);
    }
    console.error("");
    process.exit(1);
  }

  console.log("✓ Manifest validation passed");
}
