import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import createTypeDocsData from "../src/server/data/types.js";
import { sampleTypeManifest } from "./fixtures/type-fixtures.js";

describe("createTypeDocsData", () => {
  let tempDir;
  let manifestPath;

  beforeEach(() => {
    tempDir = join(tmpdir(), `wtfm-types-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    manifestPath = join(tempDir, "type-manifest.json");
  });

  it("returns a function", () => {
    const fn = createTypeDocsData({ typeManifestPath: manifestPath });
    expect(typeof fn).toBe("function");
  });

  it("returns empty array when manifest file is missing", () => {
    const fn = createTypeDocsData({
      typeManifestPath: "/missing.json",
    });
    const result = fn();
    expect(result).toEqual([]);
  });

  it("returns empty array for manifest with no docUrl declarations", () => {
    writeFileSync(
      manifestPath,
      JSON.stringify({
        modules: [
          {
            path: "src/test.ts",
            declarations: [
              {
                kind: "interface",
                name: "NoUrl",
                description: "No docUrl tag.",
                members: [],
              },
            ],
          },
        ],
      }),
    );
    const fn = createTypeDocsData({ typeManifestPath: manifestPath });
    const result = fn();
    expect(result).toEqual([]);
  });

  it("extracts type declarations with docUrl", () => {
    writeFileSync(manifestPath, JSON.stringify(sampleTypeManifest));
    const fn = createTypeDocsData({ typeManifestPath: manifestPath });
    const result = fn();

    expect(result.length).toBe(4); // SchemeEvents, EspBusEventMap, getEspBus, ESP_EVENTS
  });

  it("populates correct fields from manifest declarations", () => {
    writeFileSync(manifestPath, JSON.stringify(sampleTypeManifest));
    const fn = createTypeDocsData({ typeManifestPath: manifestPath });
    const result = fn();

    const schemeEvents = result.find((r) => r.name === "SchemeEvents");
    expect(schemeEvents).toBeDefined();
    expect(schemeEvents.kind).toBe("interface");
    expect(schemeEvents.url).toBe("/api/scheme-events");
    expect(schemeEvents.menuLabel).toBe("Scheme Events");
    expect(schemeEvents.pageTitle).toBe("SchemeEvents");
  });

  it("falls back to name for pageTitle when no docPageTitle or menuLabel", () => {
    writeFileSync(manifestPath, JSON.stringify(sampleTypeManifest));
    const fn = createTypeDocsData({ typeManifestPath: manifestPath });
    const result = fn();

    const getEspBus = result.find((r) => r.name === "getEspBus");
    expect(getEspBus.pageTitle).toBe("getEspBus");
  });

  it("extracts first sentence for metaDescription", () => {
    writeFileSync(manifestPath, JSON.stringify(sampleTypeManifest));
    const fn = createTypeDocsData({ typeManifestPath: manifestPath });
    const result = fn();

    const schemeEvents = result.find((r) => r.name === "SchemeEvents");
    expect(schemeEvents.metaDescription).toBe(
      "Theme coordination events.",
    );
  });

  it("sorts results alphabetically by URL", () => {
    writeFileSync(manifestPath, JSON.stringify(sampleTypeManifest));
    const fn = createTypeDocsData({ typeManifestPath: manifestPath });
    const result = fn();

    const urls = result.map((r) => r.url);
    const sorted = [...urls].sort();
    expect(urls).toEqual(sorted);
  });

  it("builds breadcrumbs for each item", () => {
    writeFileSync(manifestPath, JSON.stringify(sampleTypeManifest));
    const fn = createTypeDocsData({ typeManifestPath: manifestPath });
    const result = fn();

    const schemeEvents = result.find((r) => r.name === "SchemeEvents");
    expect(schemeEvents.crumbs).toBeDefined();
    expect(schemeEvents.crumbs.length).toBeGreaterThanOrEqual(2);
    expect(schemeEvents.crumbs[0].label).toBe("Api");
  });

  // Cleanup
  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true });
    } catch {
      // ignore cleanup errors
    }
  });
});
