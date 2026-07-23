import { describe, expect, it, vi } from "vitest";
import manifestPlugin from "../src/server/bundler/plugin-manifest.js";

function generateManifest(options) {
  const plugin = manifestPlugin(options);
  const emitFile = vi.fn();
  plugin.generateBundle.call(
    { emitFile },
    {},
    {
      "docs.123.js": { type: "chunk", name: "docs.js" },
      "styles.456.css": { type: "asset", name: "styles.css" },
    },
  );
  return JSON.parse(emitFile.mock.calls[0][0].source);
}

describe("bundler manifest URL prefixes", () => {
  it("normalizes an internal prefix to root-absolute URLs", () => {
    expect(generateManifest({ prefix: "dist" })).toEqual({
      "docs.js": "/dist/docs.123.js",
      "styles.css": "/dist/styles.456.css",
    });
  });

  it("preserves an external asset base", () => {
    expect(
      generateManifest({ prefix: "https://cdn.example.com/docs" }),
    ).toEqual({
      "docs.js": "https://cdn.example.com/docs/docs.123.js",
      "styles.css": "https://cdn.example.com/docs/styles.456.css",
    });
  });
});
