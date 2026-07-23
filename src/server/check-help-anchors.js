import { HELP_MANIFEST_SCHEMA_VERSION } from "./help-manifest.js";

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateStringList(value, context, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${context} must be an array of anchor ids.`);
    return null;
  }

  const seen = new Set();
  for (const id of value) {
    if (typeof id !== "string" || !id) {
      errors.push(`${context} contains a non-string or empty anchor id.`);
      continue;
    }
    if (seen.has(id)) {
      errors.push(`${context} contains duplicate anchor "${id}".`);
    }
    seen.add(id);
  }
  return seen;
}

function validateSchemaVersion(input, name, errors) {
  if (input?.schemaVersion !== HELP_MANIFEST_SCHEMA_VERSION) {
    errors.push(
      `${name} schemaVersion must be ${HELP_MANIFEST_SCHEMA_VERSION}; received ${JSON.stringify(input?.schemaVersion)}.`,
    );
    return false;
  }
  return true;
}

function indexManifest(manifest, errors) {
  if (!isObject(manifest)) {
    errors.push("Help manifest must be a JSON object.");
    return null;
  }
  validateSchemaVersion(manifest, "Help manifest", errors);
  if (!Array.isArray(manifest.surfaces)) {
    errors.push("Help manifest surfaces must be an array.");
    return null;
  }

  const entries = new Map();
  for (const surface of manifest.surfaces) {
    if (!isObject(surface) || typeof surface.slug !== "string" || !surface.slug) {
      errors.push("Help manifest contains a surface without a valid slug.");
      continue;
    }
    if (entries.has(surface.slug)) {
      errors.push(`Help manifest contains duplicate surface "${surface.slug}".`);
      continue;
    }
    if (typeof surface.referenceUrl !== "string" || !surface.referenceUrl) {
      errors.push(`Help manifest surface "${surface.slug}" has no referenceUrl.`);
    }
    if (typeof surface.helpUrl !== "string" || !surface.helpUrl) {
      errors.push(`Help manifest surface "${surface.slug}" has no helpUrl.`);
    }
    const anchors = validateStringList(
      surface.anchors,
      `Help manifest surface "${surface.slug}"`,
      errors,
    );
    entries.set(surface.slug, anchors ?? new Set());
  }
  return entries;
}

function indexExpected(expected, errors) {
  if (!isObject(expected)) {
    errors.push("Expected anchors file must be a JSON object.");
    return null;
  }
  validateSchemaVersion(expected, "Expected anchors file", errors);
  if (!isObject(expected.surfaces)) {
    errors.push("Expected anchors surfaces must be an object keyed by surface slug.");
    return null;
  }

  const entries = new Map();
  for (const [slug, anchorsValue] of Object.entries(expected.surfaces)) {
    if (!slug) {
      errors.push("Expected anchors contains an empty surface slug.");
      continue;
    }
    const anchors = validateStringList(
      anchorsValue,
      `Expected anchors surface "${slug}"`,
      errors,
    );
    entries.set(slug, anchors ?? new Set());
  }
  return entries;
}

/**
 * Compare a built help manifest with a consumer-owned expected-anchor file.
 *
 * @param {object} manifest
 * @param {object} expected
 * @param {object} [options]
 * @param {boolean} [options.strict=false]
 * @returns {{ok: boolean, errors: string[], warnings: string[]}}
 */
export function checkHelpAnchors(manifest, expected, options = {}) {
  const errors = [];
  const warnings = [];
  const manifestSurfaces = indexManifest(manifest, errors);
  const expectedSurfaces = indexExpected(expected, errors);

  if (manifestSurfaces && expectedSurfaces) {
    for (const [slug, expectedAnchors] of expectedSurfaces) {
      const actualAnchors = manifestSurfaces.get(slug);
      if (!actualAnchors) {
        errors.push(`Missing expected help surface "${slug}".`);
        continue;
      }
      for (const id of expectedAnchors) {
        if (!actualAnchors.has(id)) {
          errors.push(`Surface "${slug}" is missing expected anchor "${id}".`);
        }
      }
    }

    const extras = [];
    for (const [slug, actualAnchors] of manifestSurfaces) {
      const expectedAnchors = expectedSurfaces.get(slug);
      if (!expectedAnchors) {
        extras.push(`Built help manifest contains orphaned surface "${slug}".`);
        continue;
      }
      for (const id of actualAnchors) {
        if (!expectedAnchors.has(id)) {
          extras.push(`Surface "${slug}" contains orphaned anchor "${id}".`);
        }
      }
    }

    if (options.strict) errors.push(...extras);
    else warnings.push(...extras);
  }

  return { ok: errors.length === 0, errors, warnings };
}
