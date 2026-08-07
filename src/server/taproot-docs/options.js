/**
 * Resolution and structural validation for the opt-in `taprootDocs` plugin
 * options block (WTFM0010).
 *
 * This module owns the shape of WTFM's configuration surface: presence,
 * types, unknown keys, and fail-closed provenance completeness. It does not
 * re-implement the artifact contract's value formats — the assembled manifest
 * is serialized and asserted through `@taprootio/docs-artifact` at emit time,
 * which remains the single format authority.
 */

const TOP_LEVEL_KEYS = new Set([
  "source",
  "ciEnvironment",
  "defaultLocale",
  "localeLabel",
  "navigation",
  "assets",
  "assetsRoot",
  "sourceDateEpoch",
]);

const SOURCE_KEYS = new Set([
  "provider",
  "repositoryId",
  "repository",
  "repositoryUrl",
  "revision",
  "ref",
]);

const NAVIGATION_NODE_KEYS = new Set(["label", "resourceKey", "children"]);
const ASSET_DECLARATION_KEYS = new Set(["key", "source"]);

function fail(message) {
  throw new Error(`wtfm taprootDocs: ${message}`);
}

function requireNonEmptyString(value, name) {
  if (typeof value !== "string" || value.length === 0) {
    fail(`${name} must be a non-empty string.`);
  }
  return value;
}

function optionalNonEmptyString(value, name) {
  if (value === undefined) return undefined;
  return requireNonEmptyString(value, name);
}

/**
 * Validates one declared-asset entry: `{ key, source }`, where `source` is a
 * relative file path resolved against the Eleventy input directory (or the
 * configured `assetsRoot`). Path *safety* is structural and enforced here;
 * the artifact-side key and path formats are enforced by the contract package
 * when the manifest is asserted.
 *
 * @param {unknown} declaration
 * @param {string} context - Diagnostic prefix, e.g. `assets[2]`.
 * @returns {{ key: string, source: string }}
 */
export function validateAssetDeclaration(declaration, context) {
  if (declaration === null || typeof declaration !== "object" || Array.isArray(declaration)) {
    fail(`${context} must be an object with 'key' and 'source'.`);
  }
  for (const key of Object.keys(declaration)) {
    if (!ASSET_DECLARATION_KEYS.has(key)) fail(`${context} has unknown key '${key}'.`);
  }
  const key = requireNonEmptyString(declaration.key, `${context}.key`);
  let source = requireNonEmptyString(declaration.source, `${context}.source`);
  if (source.startsWith("./")) source = source.slice(2);
  if (source.includes("\\")) {
    fail(`${context}.source must use forward slashes.`);
  }
  if (source.startsWith("/") || /^[A-Za-z]:/u.test(source) || source.startsWith("~")) {
    fail(`${context}.source must be a relative path — sources resolve against the Eleventy input directory (or taprootDocs.assetsRoot).`);
  }
  const segments = source.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    fail(`${context}.source may not contain empty, '.', or '..' segments.`);
  }
  return { key, source };
}

/**
 * Validates a list of declared assets and rejects duplicate keys.
 *
 * @param {unknown} declarations
 * @param {string} context
 * @returns {Array<{ key: string, source: string }>}
 */
export function validateAssetDeclarations(declarations, context) {
  if (!Array.isArray(declarations)) fail(`${context} must be an array.`);
  const seen = new Map();
  const validated = declarations.map((declaration, index) => {
    const entry = validateAssetDeclaration(declaration, `${context}[${index}]`);
    const previous = seen.get(entry.key);
    if (previous !== undefined) {
      fail(`${context}[${index}] duplicates asset key '${entry.key}' (also declared at ${context}[${previous}]).`);
    }
    seen.set(entry.key, index);
    return entry;
  });
  return validated;
}

function validateNavigationNodes(nodes, context, depth = 0) {
  if (!Array.isArray(nodes)) fail(`${context} must be an array of navigation nodes.`);
  return nodes.map((node, index) => {
    const nodeContext = `${context}[${index}]`;
    if (node === null || typeof node !== "object" || Array.isArray(node)) {
      fail(`${nodeContext} must be an object.`);
    }
    for (const key of Object.keys(node)) {
      if (!NAVIGATION_NODE_KEYS.has(key)) fail(`${nodeContext} has unknown key '${key}'.`);
    }
    const label = requireNonEmptyString(node.label, `${nodeContext}.label`);
    const resourceKey = optionalNonEmptyString(node.resourceKey, `${nodeContext}.resourceKey`);
    const children = node.children === undefined
      ? undefined
      : validateNavigationNodes(node.children, `${nodeContext}.children`, depth + 1);
    const validated = { label };
    if (resourceKey !== undefined) validated.resourceKey = resourceKey;
    if (children !== undefined) validated.children = children;
    return validated;
  });
}

function resolveSourceDateEpoch(raw, env) {
  if (raw !== undefined) {
    if (!Number.isInteger(raw) || raw < 0) {
      fail("sourceDateEpoch must be a non-negative integer.");
    }
    return raw;
  }
  const fromEnvironment = env.SOURCE_DATE_EPOCH;
  if (typeof fromEnvironment === "string" && fromEnvironment !== "") {
    if (!/^\d+$/u.test(fromEnvironment)) {
      fail("SOURCE_DATE_EPOCH must be a non-negative integer.");
    }
    return Number.parseInt(fromEnvironment, 10);
  }
  // Deferred: the emitter falls back to the HEAD commit timestamp, and fails
  // closed when no deterministic timestamp source exists at all.
  return null;
}

/**
 * Resolves and validates the `taprootDocs` plugin options block.
 *
 * Returns `null` when the block is absent — the build mode is opt-in and the
 * plugin behaves exactly as before. Throws on any structural problem or on
 * incomplete provenance so a misconfigured docs build fails at plugin setup,
 * not at emit.
 *
 * @param {unknown} raw - The `taprootDocs` value passed to the plugin.
 * @param {{ env?: Record<string, string | undefined> }} [context]
 */
export function resolveTaprootDocsOptions(raw, { env = process.env } = {}) {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) fail("options must be an object.");
  for (const key of Object.keys(raw)) {
    if (!TOP_LEVEL_KEYS.has(key)) fail(`unknown option '${key}'.`);
  }

  const ciEnvironment = raw.ciEnvironment ?? false;
  if (typeof ciEnvironment !== "boolean") fail("ciEnvironment must be a boolean.");

  const sourceRaw = raw.source ?? {};
  if (sourceRaw === null || typeof sourceRaw !== "object" || Array.isArray(sourceRaw)) {
    fail("source must be an object.");
  }
  for (const key of Object.keys(sourceRaw)) {
    if (!SOURCE_KEYS.has(key)) fail(`source has unknown key '${key}'.`);
  }

  const fromEnvironment = (name) => {
    if (!ciEnvironment) return undefined;
    const value = env[name];
    return typeof value === "string" && value !== "" ? value : undefined;
  };

  const provider = sourceRaw.provider ?? "github";
  if (provider !== "github") {
    fail('source.provider must be "github" — the v1 contract is GitHub-only.');
  }
  const repository = optionalNonEmptyString(sourceRaw.repository, "source.repository")
    ?? fromEnvironment("GITHUB_REPOSITORY");
  const source = {
    provider,
    repositoryId: optionalNonEmptyString(sourceRaw.repositoryId, "source.repositoryId")
      ?? fromEnvironment("GITHUB_REPOSITORY_ID"),
    repository,
    repositoryUrl: optionalNonEmptyString(sourceRaw.repositoryUrl, "source.repositoryUrl")
      ?? (repository === undefined ? undefined : `https://github.com/${repository}`),
    revision: optionalNonEmptyString(sourceRaw.revision, "source.revision")
      ?? fromEnvironment("GITHUB_SHA"),
    ref: optionalNonEmptyString(sourceRaw.ref, "source.ref")
      ?? fromEnvironment("GITHUB_REF"),
  };
  for (const field of ["repositoryId", "repository", "repositoryUrl", "revision", "ref"]) {
    if (source[field] === undefined) {
      const hint = ciEnvironment
        ? "set it explicitly — the CI environment did not provide it"
        : "set it explicitly, or set ciEnvironment: true to allow GITHUB_* fallbacks";
      fail(`source.${field} is required; ${hint}. The stable repository id is never inferred from a checkout.`);
    }
  }

  const defaultLocale = raw.defaultLocale === undefined
    ? "en-US"
    : requireNonEmptyString(raw.defaultLocale, "defaultLocale");
  const localeLabel = raw.localeLabel === undefined
    ? "English"
    : requireNonEmptyString(raw.localeLabel, "localeLabel");

  if (!("navigation" in raw)) {
    fail("navigation is required — provide an ordered, non-empty tree of { label, resourceKey?, children? } nodes.");
  }
  const navigation = validateNavigationNodes(raw.navigation, "navigation");
  if (navigation.length === 0) {
    fail("navigation may not be empty — the artifact contract requires at least one navigation node.");
  }
  const assets = validateAssetDeclarations(raw.assets ?? [], "assets");
  // Asset sources resolve against the Eleventy input directory by default;
  // assetsRoot (absolute, or relative to the input directory) points at a
  // different base — e.g. a project root above `dir.input`.
  const assetsRoot = raw.assetsRoot === undefined
    ? null
    : requireNonEmptyString(raw.assetsRoot, "assetsRoot");
  const sourceDateEpoch = resolveSourceDateEpoch(raw.sourceDateEpoch, env);

  return {
    source,
    ciEnvironment,
    defaultLocale,
    localeLabel,
    navigation,
    assets,
    assetsRoot,
    sourceDateEpoch,
  };
}
