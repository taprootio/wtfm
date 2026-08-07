/**
 * Reference-surface resources for the Taproot Docs artifact (WTFM0010).
 *
 * Each documentation surface (WTFM0005) becomes one `reference:<slug>`
 * resource. The surface slug is already an explicit, duplicate-checked
 * identifier, so it is a stable identity source; everything else about the
 * resource is derived deterministically from the CEM.
 *
 * Composition reuses the same section renderers as the site pages in their
 * semantic mode, so reference content cannot drift between the two outputs.
 * The anchor join is a single hyphen because the artifact contract's heading
 * ids allow only single-hyphen-separated runs; site pages keep their
 * historical `--` namespacing.
 */

import { renderAnchoredHeading } from "../anchors.js";

export const DOCS_ANCHOR_JOIN = "-";

function fail(message) {
  throw new Error(`wtfm taprootDocs: ${message}`);
}

/**
 * Maps every CEM declaration object to the path of the module that declares
 * it, for provenance source locations.
 *
 * @param {{ modules?: Array<{ path?: string, declarations?: Array<object> }> }} customElements
 * @returns {Map<object, string>}
 */
export function buildModulePathIndex(customElements) {
  const index = new Map();
  for (const module of customElements?.modules ?? []) {
    for (const declaration of module.declarations ?? []) {
      if (typeof module.path === "string" && module.path.length > 0) {
        index.set(declaration, module.path);
      }
    }
  }
  return index;
}

function normalizeDescription(description) {
  return (description ?? "").split(/\n\s*\n/u, 1)[0].replace(/\s+/gu, " ").trim();
}

/**
 * Builds the resource descriptors for every documentation surface.
 *
 * @param {Array<object>} surfaces - Validated surfaces from `collectSurfaces`.
 * @param {object} customElements - The parsed Custom Elements Manifest.
 * @returns {Array<{
 *   key: string, kind: string, audiences: string[], tags: string[],
 *   title: string, description: string, route: string, sourcePath: string,
 *   surface: object,
 * }>}
 */
export function collectSurfaceResources(surfaces, customElements) {
  const modulePaths = buildModulePathIndex(customElements);
  const declarations = (customElements?.modules ?? []).flatMap(
    (module) => module.declarations ?? [],
  );

  const resources = surfaces.map((surface) => {
    const owner = declarations.find(
      (declaration) => declaration.docSurface
        && declaration.tagName === surface.tagName
        && (declaration.docSurface.name ?? declaration.docSurface) === surface.slug,
    ) ?? declarations.find((declaration) => declaration.tagName === surface.tagName);
    if (!owner) {
      fail(`surface "${surface.slug}" has no defining declaration in the Custom Elements Manifest.`);
    }
    const description = normalizeDescription(owner.description);
    if (description === "") {
      fail(`surface "${surface.slug}" needs a class description on <${surface.tagName}> — the Docs artifact requires a resource description.`);
    }
    const sourcePath = modulePaths.get(owner);
    if (sourcePath === undefined) {
      fail(`surface "${surface.slug}" has no module path in the Custom Elements Manifest for <${surface.tagName}>.`);
    }
    return {
      key: `reference:${surface.slug}`,
      kind: "reference",
      audiences: ["developer"],
      tags: [],
      title: surface.pageTitle,
      description,
      route: surface.referenceUrl,
      sourcePath,
      surface,
    };
  });

  return resources.sort((left, right) => (left.key < right.key ? -1 : left.key > right.key ? 1 : 0));
}

/**
 * Composes one surface's reference document as semantic Markdown, ready for
 * the constrained fragment renderer.
 *
 * @param {object} surface
 * @param {{ renderDeclaration(declaration: object, overrides: object): Promise<string> }} dependencies
 * @returns {Promise<string>}
 */
export async function composeSurfaceReferenceMarkdown(surface, { renderDeclaration }) {
  let markdown = "";
  for (const member of surface.members) {
    markdown += `\n${renderAnchoredHeading(2, `\`<${member.tagName}>\``, {
      override: member.helpAnchor,
      join: DOCS_ANCHOR_JOIN,
    })}\n`;
    markdown += await renderDeclaration(member, {
      semantic: true,
      anchorJoin: DOCS_ANCHOR_JOIN,
      anchorPrefix: member.tagName,
      headingOffset: 1,
      includeHeader: false,
    });
  }
  return markdown;
}
