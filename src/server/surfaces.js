import { tagValue } from "./anchors.js";
import { toRootAbsoluteUrl } from "./urls.js";

const SURFACE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function defaultReferenceUrl(slug) {
  return `/surfaces/${slug}/`;
}

function defaultHelpUrl(slug) {
  return `/surfaces/${slug}/help/`;
}

function parseParts(tag, slug) {
  const raw = tagValue(tag);
  if (!raw) {
    throw new Error(
      `wtfm: Surface "${slug}" must declare at least one @docSurfaceParts custom-element tag.`,
    );
  }

  const parts = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    throw new Error(`wtfm: Surface "${slug}" has an empty @docSurfaceParts list.`);
  }

  const seen = new Set();
  for (const part of parts) {
    if (seen.has(part)) {
      throw new Error(
        `wtfm: Surface "${slug}" lists duplicate part "${part}".`,
      );
    }
    seen.add(part);
  }
  return parts;
}

function resolveRoute(builder, fallback, slug, surface) {
  const value = typeof builder === "function"
    ? builder(slug, surface)
    : fallback(slug);
  const normalized = toRootAbsoluteUrl(value);
  if (!normalized) {
    throw new Error(`wtfm: Surface "${slug}" resolved to an empty URL.`);
  }
  return normalized;
}

function parseMenuOrder(tag) {
  const value = Number.parseFloat(tagValue(tag));
  return Number.isFinite(value) ? value : undefined;
}

function parentReferenceUrl(referenceUrl) {
  const path = String(referenceUrl).split(/[?#]/u, 1)[0].replace(/\/+$/u, "");
  if (!path) return "/";
  const separator = path.lastIndexOf("/");
  return separator >= 0 ? path.slice(0, separator + 1) || "/" : "/";
}

/**
 * Collect and validate surface definitions from a Custom Elements Manifest.
 *
 * @param {object} customElements
 * @param {object} [options]
 * @param {(slug: string, surface: object) => string} [options.referenceUrlBuilder]
 * @param {(slug: string, surface: object) => string} [options.helpUrlBuilder]
 * @returns {object[]}
 */
export function collectSurfaces(customElements, options = {}) {
  const declarations = (customElements?.modules ?? []).flatMap(
    (mod) => mod.declarations ?? [],
  );
  const byTagName = new Map();

  for (const decl of declarations) {
    if (!decl.tagName) continue;
    const matches = byTagName.get(decl.tagName) ?? [];
    matches.push(decl);
    byTagName.set(decl.tagName, matches);
  }

  const surfaces = [];
  const seenSlugs = new Set();

  for (const owner of declarations.filter((decl) => decl.docSurface)) {
    if (!owner.tagName) {
      throw new Error(
        "wtfm: @docSurface must be declared on a custom-element declaration.",
      );
    }
    const slug = tagValue(owner.docSurface);
    if (!slug || !SURFACE_SLUG.test(slug)) {
      throw new Error(
        `wtfm: Invalid @docSurface slug "${slug ?? ""}"; use lowercase kebab-case.`,
      );
    }
    if (seenSlugs.has(slug)) {
      throw new Error(`wtfm: Duplicate surface slug "${slug}".`);
    }
    seenSlugs.add(slug);

    const pageTitle = tagValue(owner.docSurfaceTitle);
    if (!pageTitle) {
      throw new Error(
        `wtfm: Surface "${slug}" must declare @docSurfaceTitle.`,
      );
    }

    const memberTags = parseParts(owner.docSurfaceParts, slug);
    const members = memberTags.map((tagName) => {
      const matches = byTagName.get(tagName) ?? [];
      if (matches.length === 0) {
        throw new Error(
          `wtfm: Surface "${slug}" references unknown part "${tagName}".`,
        );
      }
      if (matches.length > 1) {
        throw new Error(
          `wtfm: Surface "${slug}" references ambiguous part "${tagName}" (${matches.length} declarations).`,
        );
      }
      return matches[0];
    });

    const draft = {
      slug,
      pageTitle,
      className: owner.name,
      tagName: owner.tagName,
      menuLabel: tagValue(owner.menuLabel) || pageTitle,
      menuIcon: tagValue(owner.menuIcon),
      menuGroup: tagValue(owner.menuGroup),
      menuOrder: parseMenuOrder(owner.menuOrder),
      memberTags,
      members,
    };
    const referenceUrl = resolveRoute(
      options.referenceUrlBuilder,
      defaultReferenceUrl,
      slug,
      draft,
    );
    const helpUrl = resolveRoute(
      options.helpUrlBuilder,
      defaultHelpUrl,
      slug,
      draft,
    );

    surfaces.push({
      ...draft,
      url: referenceUrl,
      referenceUrl,
      helpUrl,
      crumbs: [
        { label: "Surfaces", url: parentReferenceUrl(referenceUrl) },
        { label: pageTitle, url: referenceUrl },
      ],
    });
  }

  surfaces.sort((a, b) => {
    const orderA = a.menuOrder ?? Infinity;
    const orderB = b.menuOrder ?? Infinity;
    if (orderA !== orderB) return orderA - orderB;
    return a.referenceUrl.localeCompare(b.referenceUrl);
  });
  return surfaces;
}

/**
 * Find a validated surface or throw an actionable build error.
 *
 * @param {object[]} surfaces
 * @param {string} slug
 * @returns {object}
 */
export function findSurface(surfaces, slug) {
  const surface = surfaces.find((candidate) => candidate.slug === slug);
  if (!surface) {
    throw new Error(`wtfm: Unknown documentation surface "${slug}".`);
  }
  return surface;
}
