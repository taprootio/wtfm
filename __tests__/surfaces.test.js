import { describe, expect, it } from "vitest";
import { collectSurfaces, findSurface } from "../src/server/surfaces.js";

function tag(value) {
  const [name, ...description] = value.split(" ");
  return { name, description: description.join(" ") };
}

function declaration(name, tagName, extra = {}) {
  return { name, tagName, description: `${name} docs.`, ...extra };
}

function manifest(declarations) {
  return { modules: [{ declarations }] };
}

describe("collectSurfaces", () => {
  it("collects ordered members, menu metadata, and default routes", () => {
    const shell = declaration("SurfaceShell", "surface-shell", {
      docSurface: tag("settings"),
      docSurfaceTitle: tag("Settings Surface"),
      docSurfaceParts: tag("surface-shell, surface-panel"),
      menuLabel: tag("Settings"),
      menuIcon: tag("tune"),
      menuGroup: tag("Admin"),
      menuOrder: tag("3"),
    });
    const panel = declaration("SurfacePanel", "surface-panel");

    expect(collectSurfaces(manifest([panel, shell]))).toEqual([
      expect.objectContaining({
        slug: "settings",
        pageTitle: "Settings Surface",
        className: "SurfaceShell",
        tagName: "surface-shell",
        menuLabel: "Settings",
        menuIcon: "tune",
        menuGroup: "Admin",
        menuOrder: 3,
        memberTags: ["surface-shell", "surface-panel"],
        members: [shell, panel],
        url: "/surfaces/settings/",
        referenceUrl: "/surfaces/settings/",
        helpUrl: "/surfaces/settings/help/",
      }),
    ]);
  });

  it("supports consumer-owned reference and help routes", () => {
    const owner = declaration("SurfaceShell", "surface-shell", {
      docSurface: tag("settings"),
      docSurfaceTitle: tag("Settings"),
      docSurfaceParts: tag("surface-shell"),
    });

    const [surface] = collectSurfaces(manifest([owner]), {
      referenceUrlBuilder: (slug) => `reference/${slug}`,
      helpUrlBuilder: (slug) => `/guides/${slug}/`,
    });

    expect(surface.referenceUrl).toBe("/reference/settings");
    expect(surface.helpUrl).toBe("/guides/settings/");
  });

  it.each([
    ["invalid slug", { docSurface: tag("Not Valid") }, "Invalid @docSurface slug"],
    ["missing title", { docSurfaceTitle: undefined }, "must declare @docSurfaceTitle"],
    ["missing parts", { docSurfaceParts: undefined }, "must declare at least one"],
    ["unknown part", { docSurfaceParts: tag("not-an-element") }, "unknown part"],
  ])("rejects %s", (_label, override, message) => {
    const owner = declaration("SurfaceShell", "surface-shell", {
      docSurface: tag("settings"),
      docSurfaceTitle: tag("Settings"),
      docSurfaceParts: tag("surface-shell"),
      ...override,
    });

    expect(() => collectSurfaces(manifest([owner]))).toThrow(message);
  });

  it("rejects duplicate surface slugs, member tags, and declarations", () => {
    const owner = declaration("SurfaceShell", "surface-shell", {
      docSurface: tag("settings"),
      docSurfaceTitle: tag("Settings"),
      docSurfaceParts: tag("surface-shell, surface-panel"),
    });
    const otherOwner = declaration("OtherShell", "other-shell", {
      docSurface: tag("settings"),
      docSurfaceTitle: tag("Other"),
      docSurfaceParts: tag("other-shell"),
    });
    const panel = declaration("SurfacePanel", "surface-panel");
    expect(() => collectSurfaces(manifest([owner, panel, otherOwner]))).toThrow(
      'Duplicate surface slug "settings"',
    );

    expect(() =>
      collectSurfaces(manifest([{ ...owner, docSurfaceParts: tag("surface-shell, surface-shell") }])),
    ).toThrow('duplicate part "surface-shell"');

    const duplicateA = declaration("PanelA", "surface-panel");
    const duplicateB = declaration("PanelB", "surface-panel");
    expect(() => collectSurfaces(manifest([owner, duplicateA, duplicateB]))).toThrow(
      'ambiguous part "surface-panel"',
    );
  });

  it("requires @docSurface on a custom element and rejects empty routes", () => {
    const owner = {
      name: "SettingsType",
      docSurface: tag("settings"),
      docSurfaceTitle: tag("Settings"),
      docSurfaceParts: tag("surface-shell"),
    };
    expect(() => collectSurfaces(manifest([owner]))).toThrow(
      "must be declared on a custom-element declaration",
    );

    const elementOwner = declaration("SurfaceShell", "surface-shell", {
      docSurface: tag("settings"),
      docSurfaceTitle: tag("Settings"),
      docSurfaceParts: tag("surface-shell"),
    });
    expect(() =>
      collectSurfaces(manifest([elementOwner]), {
        helpUrlBuilder: () => "",
      }),
    ).toThrow("resolved to an empty URL");
  });

  it("finds known surfaces and rejects unknown slugs", () => {
    const surfaces = [{ slug: "settings" }];
    expect(findSurface(surfaces, "settings")).toBe(surfaces[0]);
    expect(() => findSurface(surfaces, "missing")).toThrow(
      'Unknown documentation surface "missing"',
    );
  });
});
