import { describe, expect, it } from "vitest";
import {
  applyPathPrefix,
  buildHelpManifest,
  extractHelpHeadingIds,
} from "../src/server/help-manifest.js";

const surfaces = [{
  slug: "settings",
  referenceUrl: "/surfaces/settings/",
  helpUrl: "/surfaces/settings/help/",
}];

const results = [
  {
    url: "/surfaces/settings/",
    content: '<h1 id="reference">Reference</h1>',
  },
  {
    url: "/surfaces/settings/help/",
    content: '<h1 id="settings-help">Help</h1><h2 id="Title">Title</h2>',
  },
];

describe("help manifest", () => {
  it("builds a versioned, path-prefixed surface index from final results", () => {
    expect(buildHelpManifest(surfaces, results, { pathPrefix: "/help/" })).toEqual({
      schemaVersion: 1,
      surfaces: [{
        slug: "settings",
        referenceUrl: "/help/surfaces/settings/",
        helpUrl: "/help/surfaces/settings/help/",
        anchors: ["settings-help", "Title"],
      }],
    });
  });

  it("matches directory routes to index.html results", () => {
    const indexResults = results.map((result) => ({
      ...result,
      url: `${result.url}index.html`,
    }));
    expect(buildHelpManifest(surfaces, indexResults).surfaces[0].anchors).toEqual([
      "settings-help",
      "Title",
    ]);
  });

  it("fails for missing or ambiguous surface output pages", () => {
    expect(() => buildHelpManifest(surfaces, results.slice(0, 1))).toThrow(
      /missing its help page/,
    );
    expect(() => buildHelpManifest(surfaces, [...results, results[1]])).toThrow(
      /has 2 help pages/,
    );
  });

  it("extracts headings in order and rejects duplicate final ids", () => {
    expect(extractHelpHeadingIds('<h2 id="A">A</h2><h3 id=\'B\'>B</h3>')).toEqual([
      "A",
      "B",
    ]);
    expect(() =>
      extractHelpHeadingIds('<h2 id="A">A</h2><h3 id="A">Again</h3>'),
    ).toThrow(/Duplicate help heading id "A"/);
  });

  it("applies a path prefix exactly once", () => {
    expect(applyPathPrefix("/surfaces/settings/?view=all#Title", "/help/")).toBe(
      "/help/surfaces/settings/?view=all#Title",
    );
    expect(applyPathPrefix("/surfaces/settings/", "/")).toBe(
      "/surfaces/settings/",
    );
  });
});
