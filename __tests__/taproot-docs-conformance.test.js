import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Eleventy from "@11ty/eleventy";
import { validateArtifactDirectory } from "@taprootio/docs-artifact/node";
import wtfmPlugin from "../src/server/eleventy-plugin.js";

const fixtureDir = fileURLToPath(
  new URL("./fixtures/eleventy-taproot-docs/", import.meta.url),
);
const cemPath = path.join(fixtureDir, "custom-elements.json");
const validateCliPath = fileURLToPath(
  new URL("../node_modules/@taprootio/docs-artifact/bin/taproot-docs-validate.js", import.meta.url),
);
const temporaryOutputs = [];

const taprootDocs = {
  source: {
    repositoryId: "R_kgDOfixture",
    repository: "taprootio/wtfm-fixture",
    revision: "0123456789abcdef0123456789abcdef01234567",
    ref: "refs/heads/main",
  },
  navigation: [
    {
      label: "Guides",
      children: [{ label: "Getting started", resourceKey: "guide:getting-started" }],
    },
    { label: "Widget surface", resourceKey: "reference:widget" },
  ],
  sourceDateEpoch: 1767225600,
};

async function buildFixture({ withDocs }) {
  const outputDir = await mkdtemp(path.join(tmpdir(), "wtfm-taproot-docs-"));
  temporaryOutputs.push(outputDir);
  const elev = new Eleventy(fixtureDir, outputDir, {
    configPath: false,
    quietMode: true,
    config(eleventyConfig) {
      eleventyConfig.addPlugin(wtfmPlugin, {
        cemPath,
        ...(withDocs ? { taprootDocs } : {}),
      });
    },
  });
  await elev.write();
  return outputDir;
}

async function walkFiles(root, prefix = "") {
  const entries = await readdir(path.join(root, prefix), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...await walkFiles(root, relative));
    else files.push(relative);
  }
  return files.sort();
}

afterEach(async () => {
  await Promise.all(
    temporaryOutputs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

describe("Taproot Docs fixture conformance", () => {
  it("builds an artifact that passes directory validation and the published CLI", async () => {
    const outputDir = await buildFixture({ withDocs: true });

    const result = await validateArtifactDirectory(outputDir);
    expect(result.ok, JSON.stringify(result.errors ?? [])).toBe(true);

    const cli = spawnSync(process.execPath, [validateCliPath, outputDir], { encoding: "utf8" });
    expect(cli.status, cli.stderr).toBe(0);
    expect(cli.stdout).toContain("Valid Taproot Docs artifact");

    const manifest = JSON.parse(
      await readFile(path.join(outputDir, "taproot-docs-manifest.json"), "utf-8"),
    );
    expect(manifest.resources.map((resource) => resource.key)).toEqual([
      "guide:getting-started",
      "reference:widget",
    ]);
    expect(manifest.redirects).toEqual([
      {
        from: "/old-start/",
        toResourceKey: "guide:getting-started",
        locale: "en-US",
        status: 301,
      },
    ]);
    expect(manifest.assets.map((asset) => asset.key)).toEqual(["diagram-overview"]);
    expect(manifest.build).toMatchObject({
      producer: "@taprootio/wtfm",
      sourceDateEpoch: 1767225600,
    });

    const guideFragment = await readFile(
      path.join(outputDir, manifest.resources[0].variants[0].fragments[0].path),
      "utf-8",
    );
    expect(guideFragment).toContain('<a data-resource-key="reference:widget">the widget reference</a>');
    expect(guideFragment).toContain('<img data-asset-key="diagram-overview" alt="Fixture overview" width="1" height="1">');
  });

  it("emits byte-identical artifacts across repeated builds", async () => {
    const first = await buildFixture({ withDocs: true });
    const second = await buildFixture({ withDocs: true });

    const artifactFiles = [
      "taproot-docs-manifest.json",
      ...(await walkFiles(first, "taproot-docs")),
    ];
    for (const relative of artifactFiles) {
      const [left, right] = await Promise.all([
        readFile(path.join(first, relative)),
        readFile(path.join(second, relative)),
      ]);
      expect(left.equals(right), `artifact file ${relative} must be deterministic`).toBe(true);
    }
  });

  it("preserves the ordinary portable site output byte for byte", async () => {
    const withoutDocs = await buildFixture({ withDocs: false });
    const withDocs = await buildFixture({ withDocs: true });

    const ordinaryFiles = await walkFiles(withoutDocs);
    const docsFiles = await walkFiles(withDocs);

    expect(docsFiles.filter((file) => !ordinaryFiles.includes(file)).every(
      (file) => file === "taproot-docs-manifest.json" || file.startsWith("taproot-docs/"),
    )).toBe(true);

    for (const relative of ordinaryFiles) {
      const [off, on] = await Promise.all([
        readFile(path.join(withoutDocs, relative)),
        readFile(path.join(withDocs, relative)),
      ]);
      expect(on.equals(off), `ordinary output ${relative} must be unaffected`).toBe(true);
    }
  });
});
