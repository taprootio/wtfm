/**
 * Authored-document capture for the Taproot Docs artifact (WTFM0010).
 *
 * A page opts into the artifact with a `taprootDocs` front-matter block. The
 * block carries the document's durable identity and semantic classification —
 * identity is always explicit and never derived from routes, titles, or file
 * paths, so a page can move without changing what Taproot considers "the same
 * document".
 */

import { validateAssetDeclarations } from "./options.js";

const FRONT_MATTER_KEYS = new Set([
  "key",
  "kind",
  "audiences",
  "tags",
  "description",
  "redirectsFrom",
  "assets",
]);

const REDIRECT_KEYS = new Set(["from", "status"]);
const REDIRECT_STATUSES = new Set([301, 308]);

function fail(message) {
  throw new Error(`wtfm taprootDocs: ${message}`);
}

function requireNonEmptyString(value, name) {
  if (typeof value !== "string" || value.length === 0) {
    fail(`${name} must be a non-empty string.`);
  }
  return value;
}

function validateStringArray(value, name) {
  if (!Array.isArray(value)) fail(`${name} must be an array of non-empty strings.`);
  return value.map((entry, index) => requireNonEmptyString(entry, `${name}[${index}]`));
}

/**
 * Set-like front-matter arrays (audiences, tags): duplicates are authoring
 * errors, and the returned copy is sorted in code-unit order because the
 * artifact contract requires sorted unique values.
 */
function validateStringSet(value, name) {
  const entries = validateStringArray(value, name);
  const seen = new Set();
  for (const entry of entries) {
    if (seen.has(entry)) fail(`${name} contains duplicate "${entry}".`);
    seen.add(entry);
  }
  return [...entries].sort();
}

function normalizeRedirect(entry, context) {
  if (typeof entry === "string") {
    return { from: requireNonEmptyString(entry, context), status: 301 };
  }
  if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
    fail(`${context} must be a route string or { from, status }.`);
  }
  for (const key of Object.keys(entry)) {
    if (!REDIRECT_KEYS.has(key)) fail(`${context} has unknown key '${key}'.`);
  }
  const from = requireNonEmptyString(entry.from, `${context}.from`);
  const status = entry.status ?? 301;
  if (!REDIRECT_STATUSES.has(status)) {
    fail(`${context}.status must be 301 or 308.`);
  }
  return { from, status };
}

/**
 * Validates one page's `taprootDocs` front-matter block.
 *
 * @param {unknown} raw
 * @param {string} context - Document identity for error messages.
 */
export function validateTaprootDocsFrontMatter(raw, context) {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    fail(`${context}: taprootDocs front matter must be an object.`);
  }
  for (const key of Object.keys(raw)) {
    if (!FRONT_MATTER_KEYS.has(key)) fail(`${context}: taprootDocs has unknown key '${key}'.`);
  }
  const key = requireNonEmptyString(raw.key, `${context}: taprootDocs.key`);
  const kind = requireNonEmptyString(raw.kind, `${context}: taprootDocs.kind`);
  const audiences = raw.audiences === undefined
    ? ["developer"]
    : validateStringSet(raw.audiences, `${context}: taprootDocs.audiences`);
  if (audiences.length === 0) {
    fail(`${context}: taprootDocs.audiences may not be empty — omit it for the "developer" default.`);
  }
  const tags = raw.tags === undefined ? [] : validateStringSet(raw.tags, `${context}: taprootDocs.tags`);
  const description = raw.description === undefined
    ? undefined
    : requireNonEmptyString(raw.description, `${context}: taprootDocs.description`);
  const redirectsFrom = raw.redirectsFrom === undefined
    ? []
    : (Array.isArray(raw.redirectsFrom)
      ? raw.redirectsFrom.map((entry, index) =>
        normalizeRedirect(entry, `${context}: taprootDocs.redirectsFrom[${index}]`))
      : fail(`${context}: taprootDocs.redirectsFrom must be an array.`));
  const assets = raw.assets === undefined
    ? []
    : validateAssetDeclarations(raw.assets, `${context}: taprootDocs.assets`);
  return { key, kind, audiences, tags, description, redirectsFrom, assets };
}

/**
 * Collects every opted-in authored document from an Eleventy collection API.
 *
 * Returns documents sorted by resource key so downstream assembly is
 * independent of filesystem enumeration order. Duplicate keys, non-Markdown
 * inputs, and missing title/description/url/rawInput fail closed with the
 * offending file named.
 *
 * @param {{ getAll(): Array<object> }} collectionApi
 */
export function collectTaprootDocsDocuments(collectionApi) {
  const documents = [];
  const byKey = new Map();
  for (const item of collectionApi.getAll()) {
    const block = item.data?.taprootDocs;
    if (block === undefined) continue;
    const inputPath = String(item.inputPath ?? "").replace(/^\.\//u, "");
    const context = `document "${inputPath}"`;
    const frontMatter = validateTaprootDocsFrontMatter(block, context);

    if (!/\.md$/iu.test(inputPath)) {
      fail(`${context}: taprootDocs v1 supports Markdown documents only.`);
    }
    const title = item.data?.title;
    if (typeof title !== "string" || title.length === 0) {
      fail(`${context}: a non-empty title is required for the Docs artifact.`);
    }
    const description = frontMatter.description ?? item.data?.description;
    if (typeof description !== "string" || description.length === 0) {
      fail(`${context}: a description is required — set taprootDocs.description or the page's description data.`);
    }
    if (typeof item.url !== "string" || item.url.length === 0) {
      fail(`${context}: the page must have a URL to become a Docs resource (permalink: false is not supported).`);
    }
    if (typeof item.rawInput !== "string") {
      fail(`${context}: raw template input is unavailable — Taproot Docs mode requires Eleventy v3.`);
    }

    const existing = byKey.get(frontMatter.key);
    if (existing !== undefined) {
      fail(`resource key "${frontMatter.key}" is declared by both "${existing}" and "${inputPath}" — keys must be unique.`);
    }
    byKey.set(frontMatter.key, inputPath);

    documents.push({
      ...frontMatter,
      description,
      title,
      route: item.url,
      inputPath,
      rawInput: item.rawInput,
    });
  }
  return documents.sort((left, right) => (left.key < right.key ? -1 : left.key > right.key ? 1 : 0));
}
