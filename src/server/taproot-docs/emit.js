/**
 * Taproot Docs artifact emitter (WTFM0010).
 *
 * Runs inside the plugin's `eleventy.after` hook when the opt-in
 * `taprootDocs` options block is present. Assembles resources from the
 * captured authored documents and the documentation surfaces, renders every
 * fragment through the constrained semantic pipeline, resolves declared
 * assets, and writes the additive artifact payload:
 *
 *     _site/taproot-docs-manifest.json
 *     _site/taproot-docs/fragments/…
 *     _site/taproot-docs/assets/…
 *
 * The manifest is serialized with `serializeManifest` (which asserts contract
 * validity) and the written directory is re-validated with
 * `validateArtifactDirectory`, so a nonconforming artifact can never leave a
 * green build. The ordinary static site output is never read or modified —
 * only the artifact subtree is owned (and therefore reset) by the emitter.
 */

import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, rmSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import {
  FRAGMENT_MEDIA_TYPE,
  HTML_FRAGMENT_CAPABILITY,
  MANIFEST_FILE_NAME,
  SCHEMA_VERSION,
  normalizeRoute,
  serializeManifest,
} from "@taprootio/docs-artifact";
import { validateArtifactDirectory } from "@taprootio/docs-artifact/node";
import { collectRedirects, resolveDeclaredAssets } from "./assets.js";
import { renderDocsFragment } from "./fragments.js";
import { collectSurfaceResources, composeSurfaceReferenceMarkdown } from "./reference.js";

// Read lazily so importing this module has no filesystem side effects (the
// plugin test harness mocks `fs` at module scope).
let wtfmPackage;
function producerIdentity() {
  wtfmPackage ??= JSON.parse(
    readFileSync(new URL("../../../package.json", import.meta.url), "utf-8"),
  );
  return wtfmPackage;
}

function fail(message) {
  throw new Error(`wtfm taprootDocs: ${message}`);
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.keys(value).sort().map(
      (key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`,
    );
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function sha256(buffer) {
  return `sha256:${createHash("sha256").update(buffer).digest("hex")}`;
}

/**
 * Default deterministic-timestamp fallback: the HEAD commit time. Only used
 * when neither the options block nor SOURCE_DATE_EPOCH provided one.
 */
function headCommitTimestamp(projectRoot) {
  try {
    const output = execSync("git log -1 --format=%ct", {
      cwd: projectRoot,
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf-8",
    });
    const timestamp = Number.parseInt(output.trim(), 10);
    if (!Number.isInteger(timestamp) || timestamp < 0) throw new Error("unparsable git timestamp");
    return timestamp;
  } catch {
    return null;
  }
}

function canonicalRouteFor(route, context) {
  const result = normalizeRoute(route);
  if (!result.ok) {
    fail(`${context}: route "${route}" is not a canonical Docs route — ${result.message}`);
  }
  return result.value;
}

function fragmentPathFor(key, locale) {
  return `taproot-docs/fragments/${key.replace(/[:/]/gu, "-")}.${locale.toLowerCase()}.html`;
}

function assertArtifactSubtreeIsEmitterOwned(outputDirectory) {
  const root = join(outputDirectory, "taproot-docs");
  let entries;
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return; // No subtree yet — nothing to protect.
  }
  // Emitter output is exactly two directories of flat regular files, so any
  // other top-level entry — and any nested directory or non-regular entry
  // inside the owned directories — is site content a reset would destroy.
  const foreign = entries
    .filter((entry) => !(entry.isDirectory() && ["assets", "fragments"].includes(entry.name)))
    .map((entry) => entry.name);
  for (const owned of ["assets", "fragments"]) {
    let ownedEntries;
    try {
      ownedEntries = readdirSync(join(root, owned), { withFileTypes: true });
    } catch {
      continue;
    }
    foreign.push(
      ...ownedEntries
        .filter((entry) => !entry.isFile())
        .map((entry) => `${owned}/${entry.name}`),
    );
  }
  if (foreign.length > 0) {
    fail(
      `the output "taproot-docs" directory contains entries the emitter does not own (${foreign.join(", ")}) — that subtree and ${MANIFEST_FILE_NAME} are reserved for the Docs artifact and are reset on every build; move site content elsewhere.`,
    );
  }
}

function blobUrlBase(source) {
  const repositoryUrl = source.repositoryUrl.replace(/\/+$/u, "").replace(/\.git$/u, "");
  return `${repositoryUrl}/blob/${source.revision}`;
}

function validateNavigationKeys(nodes, keys, context) {
  for (const [index, node] of nodes.entries()) {
    const nodeContext = `${context}[${index}]`;
    if (node.resourceKey !== undefined && !keys.has(node.resourceKey)) {
      fail(`${nodeContext} references unknown resource key "${node.resourceKey}".`);
    }
    if (node.children) validateNavigationKeys(node.children, keys, `${nodeContext}.children`);
  }
}

function mergeAssetDeclarations(options, documents) {
  const merged = new Map();
  const owners = new Map();
  const declare = (declaration, owner) => {
    const existing = owners.get(declaration.key);
    if (existing !== undefined) {
      fail(`asset key "${declaration.key}" is declared by both ${existing} and ${owner} — declare shared assets once in the plugin's taprootDocs.assets.`);
    }
    owners.set(declaration.key, owner);
    merged.set(declaration.key, declaration);
  };
  for (const declaration of options.assets) declare(declaration, "the plugin options");
  for (const document of documents) {
    for (const declaration of document.assets) {
      declare(declaration, `document "${document.inputPath}"`);
    }
  }
  return [...merged.values()];
}

/**
 * Emits the complete Taproot Docs artifact for one finished Eleventy build.
 *
 * @param {object} input
 * @param {object} input.options - Resolved `taprootDocs` options.
 * @param {Array<object> | null} input.documents - Captured authored documents.
 * @param {Array<object>} input.surfaces - Validated documentation surfaces.
 * @param {object} input.customElements - Parsed Custom Elements Manifest.
 * @param {(declaration: object, overrides: object) => Promise<string>} input.renderDeclaration
 * @param {string} input.outputDirectory - Absolute path of the site output.
 * @param {string} input.projectRoot - Base for asset sources and git provenance.
 * @param {{ readAssetFile?: (source: string) => Buffer, resolveFallbackTimestamp?: (projectRoot: string) => number | null }} [io]
 */
export async function emitTaprootDocsArtifact(input, io = {}) {
  const {
    options,
    documents,
    surfaces,
    customElements,
    renderDeclaration,
    outputDirectory,
    projectRoot,
  } = input;
  if (documents === null) {
    fail("the authored-document collection never ran — Taproot Docs mode requires a full filesystem build.");
  }
  const readAssetFile = io.readAssetFile
    ?? ((source) => readFileSync(resolve(projectRoot, source)));
  const resolveFallbackTimestamp = io.resolveFallbackTimestamp ?? headCommitTimestamp;

  // ── Provenance ────────────────────────────────────────────────
  const sourceDateEpoch = options.sourceDateEpoch ?? resolveFallbackTimestamp(projectRoot);
  if (sourceDateEpoch === null) {
    fail("no deterministic build timestamp is available — set taprootDocs.sourceDateEpoch, SOURCE_DATE_EPOCH, or build from a git checkout.");
  }
  const producer = producerIdentity();
  const build = {
    producer: producer.name,
    producerVersion: producer.version,
    configurationSha256: sha256(Buffer.from(stableStringify(options), "utf-8")),
    sourceDateEpoch,
  };

  // ── Resources ─────────────────────────────────────────────────
  const referenceResources = collectSurfaceResources(surfaces, customElements);
  const keyOwners = new Map();
  for (const document of documents) {
    keyOwners.set(document.key, `document "${document.inputPath}"`);
  }
  for (const resource of referenceResources) {
    const existing = keyOwners.get(resource.key);
    if (existing !== undefined) {
      fail(`resource key "${resource.key}" is declared by both ${existing} and surface "${resource.surface.slug}".`);
    }
    keyOwners.set(resource.key, `surface "${resource.surface.slug}"`);
  }

  const locale = options.defaultLocale;
  const blobBase = blobUrlBase(options.source);
  const routeToKey = new Map();
  const claimRoute = (route, key, context) => {
    const canonical = canonicalRouteFor(route, context);
    const existing = routeToKey.get(canonical);
    if (existing !== undefined) {
      fail(`route "${canonical}" is claimed by both "${existing}" and "${key}".`);
    }
    routeToKey.set(canonical, key);
    return canonical;
  };

  const pending = [
    ...documents.map((document) => ({
      key: document.key,
      semantic: { kind: document.kind, audiences: document.audiences, tags: document.tags },
      title: document.title,
      description: document.description,
      sourcePath: document.inputPath,
      canonicalRoute: claimRoute(document.route, document.key, `document "${document.inputPath}"`),
      renderFragment: (renderContext) => renderDocsFragment(document.rawInput, {
        context: `document "${document.inputPath}"`,
        ...renderContext,
      }),
    })),
    ...referenceResources.map((resource) => ({
      key: resource.key,
      semantic: { kind: resource.kind, audiences: resource.audiences, tags: resource.tags },
      title: resource.title,
      description: resource.description,
      sourcePath: resource.sourcePath,
      canonicalRoute: claimRoute(resource.route, resource.key, `surface "${resource.surface.slug}"`),
      renderFragment: async (renderContext) => renderDocsFragment(
        await composeSurfaceReferenceMarkdown(resource.surface, { renderDeclaration }),
        {
          context: `surface "${resource.surface.slug}" reference document`,
          ...renderContext,
        },
      ),
    })),
  ].sort((left, right) => (left.key < right.key ? -1 : left.key > right.key ? 1 : 0));

  // ── Assets ────────────────────────────────────────────────────
  const declarations = mergeAssetDeclarations(options, documents);
  const { manifestAssets, bySource, files: assetFiles } = resolveDeclaredAssets(
    declarations,
    { readAssetFile },
  );

  // ── Fragments ─────────────────────────────────────────────────
  const resolveRouteLink = (route) => {
    const key = routeToKey.get(route) ?? routeToKey.get(`${route}/`);
    return key === undefined ? null : { resourceKey: key };
  };
  const fragmentFiles = [];
  const fragmentPaths = new Map();
  const resources = [];
  for (const entry of pending) {
    const { html, headings } = await entry.renderFragment({
      resolveRouteLink,
      assetsBySource: bySource,
    });
    const path = fragmentPathFor(entry.key, locale);
    const collision = fragmentPaths.get(path);
    if (collision !== undefined) {
      fail(`fragment path "${path}" is produced by both "${collision}" and "${entry.key}".`);
    }
    fragmentPaths.set(path, entry.key);
    const contents = Buffer.from(html, "utf-8");
    fragmentFiles.push({ path, contents });
    resources.push({
      key: entry.key,
      semantic: entry.semantic,
      variants: [
        {
          locale,
          route: entry.canonicalRoute,
          title: entry.title,
          description: entry.description,
          headings,
          source: {
            path: entry.sourcePath,
            url: `${blobBase}/${entry.sourcePath}`,
          },
          fragments: [
            {
              key: "body",
              role: "body",
              path,
              mediaType: FRAGMENT_MEDIA_TYPE,
              bytes: contents.length,
              sha256: sha256(contents),
            },
          ],
        },
      ],
    });
  }

  // ── Navigation and redirects ──────────────────────────────────
  validateNavigationKeys(options.navigation, new Set(keyOwners.keys()), "navigation");
  const redirects = collectRedirects(documents, new Set(routeToKey.keys()), locale);

  // ── Manifest ──────────────────────────────────────────────────
  const manifest = {
    schemaVersion: SCHEMA_VERSION,
    defaultLocale: locale,
    source: options.source,
    build,
    capabilities: { required: [HTML_FRAGMENT_CAPABILITY], optional: [] },
    locales: [{ tag: locale, label: options.localeLabel }],
    resources,
    navigation: [{ locale, items: options.navigation }],
    redirects,
    assets: manifestAssets,
  };

  let serialized;
  try {
    serialized = serializeManifest(manifest);
  } catch (error) {
    fail(`the assembled manifest failed contract validation:\n${error.message}`);
  }

  // ── Write the artifact payload ────────────────────────────────
  // The artifact subtree is exclusively emitter-owned: reset it so stale
  // fragments or assets from a previous build cannot linger (the directory
  // validator would reject them as undeclared files). Anything in that
  // subtree the emitter would not have written itself is site content that
  // a reset would silently destroy — fail closed instead of deleting it.
  assertArtifactSubtreeIsEmitterOwned(outputDirectory);
  rmSync(join(outputDirectory, "taproot-docs"), { recursive: true, force: true });
  rmSync(join(outputDirectory, MANIFEST_FILE_NAME), { force: true });
  for (const file of [...fragmentFiles, ...assetFiles]) {
    const absolute = join(outputDirectory, file.path);
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, file.contents);
  }
  // serializeManifest already terminates with the canonical single newline;
  // the file must stay the package's exact canonical byte stream.
  await writeFile(join(outputDirectory, MANIFEST_FILE_NAME), serialized, "utf-8");

  // ── Self-validate the written artifact ────────────────────────
  const result = await validateArtifactDirectory(outputDirectory);
  if (!result.ok) {
    const diagnostics = result.errors
      .map((error) => `${error.code} ${error.path}: ${error.message}`)
      .join("\n");
    fail(`the written artifact failed directory validation:\n${diagnostics}`);
  }

  return {
    resourceCount: resources.length,
    assetCount: manifestAssets.length,
    redirectCount: redirects.length,
  };
}
