import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import createManifestData from "../src/server/data/manifest.js";

vi.mock("fs", () => ({
  readFileSync: vi.fn(),
}));

describe("createManifestData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a function", () => {
    const fn = createManifestData({ manifestPath: "/fake/manifest.json" });
    expect(typeof fn).toBe("function");
  });

  it("reads and parses the manifest file", () => {
    const manifest = { "docs.js": "docs-abc123.js", "docs.css": "docs-def456.css" };
    readFileSync.mockReturnValue(JSON.stringify(manifest));
    const fn = createManifestData({ manifestPath: "/fake/manifest.json" });
    const result = fn();
    expect(readFileSync).toHaveBeenCalledWith(
      "/fake/manifest.json",
      "utf-8",
    );
    expect(result).toEqual(manifest);
  });

  it("returns empty object when file is missing", () => {
    readFileSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });
    const fn = createManifestData({ manifestPath: "/missing.json" });
    expect(fn()).toEqual({});
  });

  it("returns empty object when file contains invalid JSON", () => {
    readFileSync.mockReturnValue("not json");
    const fn = createManifestData({ manifestPath: "/bad.json" });
    expect(fn()).toEqual({});
  });
});
