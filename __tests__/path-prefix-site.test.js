import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Eleventy, { HtmlBasePlugin } from "@11ty/eleventy";
import wtfmPlugin from "../src/server/eleventy-plugin.js";

const fixtureDir = fileURLToPath(
  new URL("./fixtures/eleventy-path-prefix/", import.meta.url),
);
const cemPath = path.join(fixtureDir, "custom-elements.json");
const temporaryOutputs = [];

async function buildFixture(pathPrefix) {
  const outputDir = await mkdtemp(path.join(tmpdir(), "wtfm-path-prefix-"));
  temporaryOutputs.push(outputDir);

  const elev = new Eleventy(fixtureDir, outputDir, {
    configPath: false,
    pathPrefix,
    quietMode: true,
    config(eleventyConfig) {
      eleventyConfig.addPlugin(HtmlBasePlugin);
      eleventyConfig.addPlugin(wtfmPlugin, { cemPath });
    },
  });
  await elev.write();

  return {
    index: await readFile(path.join(outputDir, "index.html"), "utf-8"),
    guide: await readFile(path.join(outputDir, "guide/index.html"), "utf-8"),
    surfaceReference: await readFile(
      path.join(outputDir, "surfaces/settings/index.html"),
      "utf-8",
    ),
    surfaceHelp: await readFile(
      path.join(outputDir, "surfaces/settings/help/index.html"),
      "utf-8",
    ),
    helpManifest: JSON.parse(
      await readFile(path.join(outputDir, "help-manifest.json"), "utf-8"),
    ),
  };
}

afterEach(async () => {
  await Promise.all(
    temporaryOutputs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

describe("Eleventy path-prefix fixture", () => {
  it("prefixes root-absolute page, image, and manifest asset URLs", async () => {
    const output = await buildFixture("/help/");
    expect(output.index).toContain('href="/help/components/widget/"');
    expect(output.index).toContain('src="/help/assets/widget.png"');
    expect(output.index).toContain('src="/help/dist/docs.123.js"');
    expect(output.guide).toContain('href="/help/components/widget/"');
    expect(output.guide).toContain('src="/help/assets/widget.png"');
    expect(output.surfaceHelp).toContain('href="/help/guide/"');
    expect(output.surfaceHelp).toContain(
      'src="/help/surfaces/settings/help/images/settings.png"',
    );
  });

  it("does not rewrite external links or fragment-only anchors", async () => {
    const output = await buildFixture("/help/");
    expect(output.index).toContain(
      'href="https://example.com/reference"',
    );
    expect(output.index).toContain('href="#details"');
  });

  it("keeps root deployment output unchanged", async () => {
    const output = await buildFixture("/");
    expect(output.index).toContain('href="/components/widget/"');
    expect(output.index).toContain('src="/assets/widget.png"');
    expect(output.index).toContain('src="/dist/docs.123.js"');
    expect(output.index).not.toContain("/help/");
    expect(output.helpManifest.surfaces[0].helpUrl).toBe(
      "/surfaces/settings/help/",
    );
  });

  it("emits the versioned final surface and anchor manifest", async () => {
    const output = await buildFixture("/help/");
    expect(output.surfaceReference).toContain('id="surface-shell--attributes"');
    const source = output.surfaceReference.match(/source="([A-Za-z0-9+/=]+)"/);
    expect(source).not.toBeNull();
    expect(Buffer.from(source[1], "base64").toString()).toContain(
      'src="/help/assets/demo.png"',
    );
    expect(output.surfaceHelp).toContain('<h2 id="Title">Title</h2>');
    expect(output.helpManifest).toEqual({
      schemaVersion: 1,
      surfaces: [{
        slug: "settings",
        referenceUrl: "/help/surfaces/settings/",
        helpUrl: "/help/surfaces/settings/help/",
        anchors: ["settings-help", "Title", "advanced-options"],
      }],
    });
  });
});
