import { describe, expect, it } from "vitest";
import { checkHelpAnchors } from "../src/server/check-help-anchors.js";

function manifest(overrides = {}) {
  return {
    schemaVersion: 1,
    surfaces: [{
      slug: "settings",
      referenceUrl: "/help/surfaces/settings/",
      helpUrl: "/help/surfaces/settings/help/",
      anchors: ["settings-help", "Title"],
    }],
    ...overrides,
  };
}

function expected(overrides = {}) {
  return {
    schemaVersion: 1,
    surfaces: { settings: ["settings-help", "Title"] },
    ...overrides,
  };
}

describe("checkHelpAnchors", () => {
  it("passes a matching consumer contract", () => {
    expect(checkHelpAnchors(manifest(), expected())).toEqual({
      ok: true,
      errors: [],
      warnings: [],
    });
  });

  it("fails for missing surfaces and anchors with actionable diagnostics", () => {
    const missingSurface = checkHelpAnchors(
      manifest({ surfaces: [] }),
      expected(),
    );
    expect(missingSurface.ok).toBe(false);
    expect(missingSurface.errors).toContain('Missing expected help surface "settings".');

    const missingAnchor = checkHelpAnchors(
      manifest({ surfaces: [{ ...manifest().surfaces[0], anchors: ["settings-help"] }] }),
      expected(),
    );
    expect(missingAnchor.errors).toContain(
      'Surface "settings" is missing expected anchor "Title".',
    );
  });

  it("warns for orphaned surfaces and anchors by default", () => {
    const actual = manifest({
      surfaces: [
        { ...manifest().surfaces[0], anchors: ["settings-help", "Title", "Old"] },
        {
          slug: "orphan",
          referenceUrl: "/orphan/",
          helpUrl: "/orphan/help/",
          anchors: [],
        },
      ],
    });
    const result = checkHelpAnchors(actual, expected());
    expect(result.ok).toBe(true);
    expect(result.warnings).toContain(
      'Surface "settings" contains orphaned anchor "Old".',
    );
    expect(result.warnings).toContain(
      'Built help manifest contains orphaned surface "orphan".',
    );
  });

  it("fails for orphaned extras in strict mode", () => {
    const actual = manifest({
      surfaces: [{ ...manifest().surfaces[0], anchors: ["settings-help", "Title", "Old"] }],
    });
    const result = checkHelpAnchors(actual, expected(), { strict: true });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'Surface "settings" contains orphaned anchor "Old".',
    );
  });

  it("rejects duplicate anchors and surfaces as malformed", () => {
    const duplicateAnchors = manifest({
      surfaces: [{ ...manifest().surfaces[0], anchors: ["Title", "Title"] }],
    });
    expect(checkHelpAnchors(duplicateAnchors, expected()).errors).toContain(
      'Help manifest surface "settings" contains duplicate anchor "Title".',
    );

    const duplicateSurfaces = manifest({
      surfaces: [manifest().surfaces[0], manifest().surfaces[0]],
    });
    expect(checkHelpAnchors(duplicateSurfaces, expected()).errors).toContain(
      'Help manifest contains duplicate surface "settings".',
    );
  });

  it("rejects malformed and version-mismatched inputs", () => {
    const malformed = checkHelpAnchors(
      { schemaVersion: 1, surfaces: "not-an-array" },
      { schemaVersion: 1, surfaces: [] },
    );
    expect(malformed.ok).toBe(false);
    expect(malformed.errors).toContain("Help manifest surfaces must be an array.");
    expect(malformed.errors).toContain(
      "Expected anchors surfaces must be an object keyed by surface slug.",
    );

    const mismatched = checkHelpAnchors(
      manifest({ schemaVersion: 2 }),
      expected({ schemaVersion: 0 }),
    );
    expect(mismatched.errors).toContain(
      "Help manifest schemaVersion must be 1; received 2.",
    );
    expect(mismatched.errors).toContain(
      "Expected anchors file schemaVersion must be 1; received 0.",
    );
  });
});
