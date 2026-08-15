import { execFileSync, spawnSync } from "node:child_process";
import {
  access,
  copyFile,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { validateArtifactDirectory } from "@taprootio/docs-artifact/node";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const packageJsonPath = path.join(repositoryRoot, "package.json");
const docsConfigPath = path.join(repositoryRoot, "docs", "eleventy.config.js");
const docsBuildScriptPath = path.join(
  repositoryRoot,
  "scripts",
  "build-docs.js",
);
const networkGuardPath = path.join(
  repositoryRoot,
  "__tests__",
  "helpers",
  "network-guard.cjs",
);
const validateCliPath = path.join(
  repositoryRoot,
  "node_modules",
  "@taprootio",
  "docs-artifact",
  "bin",
  "taproot-docs-validate.js",
);

const expectedResourceKeys = [
  "concept:client-runtime",
  "concept:documents-and-surfaces",
  "concept:overview",
  "guide:getting-started",
  "guide:help-and-anchors",
  "guide:taproot-docs-artifact",
  "guide:validation-and-troubleshooting",
  "reference:plugin-configuration",
  "reference:renderers",
];

const temporaryRoots = [];
let firstBuild;
let secondBuild;
let firstNetworkLog;
let secondNetworkLog;

async function makeBuildTarget(label) {
  const root = await mkdtemp(path.join(tmpdir(), `wtfm-real-docs-${label}-`));
  temporaryRoots.push(root);
  return {
    output: path.join(root, "_site"),
    networkLog: path.join(root, "network-attempts.log"),
  };
}

function runDocsBuild({ output, networkLog }) {
  const inheritedNodeOptions = process.env.NODE_OPTIONS?.trim();
  const guardOption = `--require=${networkGuardPath}`;
  return spawnSync("npm", ["run", "docs:build", "--", "--output", output], {
    cwd: repositoryRoot,
    encoding: "utf-8",
    env: {
      ...process.env,
      NODE_OPTIONS: inheritedNodeOptions
        ? `${inheritedNodeOptions} ${guardOption}`
        : guardOption,
      WTFM_NETWORK_GUARD_LOG: networkLog,
    },
  });
}

function assertBuildSucceeded(result) {
  expect(
    result.status,
    [result.stdout, result.stderr].filter(Boolean).join("\n"),
  ).toBe(0);
}

function runGit(cwd, args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf-8" });
  expect(
    result.status,
    [result.stdout, result.stderr].filter(Boolean).join("\n"),
  ).toBe(0);
}

async function walkFiles(root, prefix = "") {
  const entries = await readdir(path.join(root, prefix), {
    withFileTypes: true,
  });
  const files = [];
  for (const entry of entries) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...(await walkFiles(root, relative)));
    else files.push(relative);
  }
  return files.sort();
}

function localTarget(outputRoot, rawUrl) {
  const withoutQuery = rawUrl.split(/[?#]/u, 1)[0];
  if (
    withoutQuery === "" ||
    withoutQuery.startsWith("#") ||
    withoutQuery.startsWith("//") ||
    /^[a-z][a-z\d+.-]*:/iu.test(withoutQuery)
  ) {
    return null;
  }
  const pathname = withoutQuery.startsWith("/")
    ? withoutQuery.slice(1)
    : withoutQuery;
  if (pathname === "" || pathname.endsWith("/")) {
    return path.join(outputRoot, pathname, "index.html");
  }
  return path.join(outputRoot, pathname);
}

beforeAll(async () => {
  const first = await makeBuildTarget("one");
  const second = await makeBuildTarget("two");
  firstBuild = first.output;
  secondBuild = second.output;
  firstNetworkLog = first.networkLog;
  secondNetworkLog = second.networkLog;

  const firstResult = runDocsBuild(first);
  assertBuildSucceeded(firstResult);
  const secondResult = runDocsBuild(second);
  assertBuildSucceeded(secondResult);
}, 30_000);

afterAll(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("real WTFM documentation project", () => {
  it("exposes documented build, validation, and focused test commands", async () => {
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf-8"));
    expect(packageJson.scripts).toMatchObject({
      "docs:build": "node ./scripts/build-docs.js",
      "docs:test": "vitest run __tests__/docs-site.test.js",
      "docs:validate": "taproot-docs-validate docs/_site",
    });
    expect(packageJson.dependencies["@taprootio/docs-artifact"]).toBe("1.0.1");
    expect(packageJson.dependencies["@taprootio/wtfm"]).toBeUndefined();
    expect(packageJson.devDependencies["@taprootio/wtfm"]).toBeUndefined();
  });

  it("builds through the working tree implementation with explicit Git provenance", async () => {
    const config = await readFile(docsConfigPath, "utf-8");
    expect(config).toContain("../src/server/eleventy-plugin.js");
    expect(config).not.toContain('from "@taprootio/wtfm"');

    const manifest = JSON.parse(
      await readFile(
        path.join(firstBuild, "taproot-docs-manifest.json"),
        "utf-8",
      ),
    );
    const revision = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repositoryRoot,
      encoding: "utf-8",
    }).trim();
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.source).toEqual({
      provider: "github",
      repositoryId: "1162327960",
      repository: "taprootio/wtfm",
      repositoryUrl: "https://github.com/taprootio/wtfm",
      revision,
      ref: "refs/heads/main",
    });
    expect(manifest.build.producer).toBe("@taprootio/wtfm");
    expect(
      manifest.resources.every((resource) =>
        resource.variants.every(
          (variant) =>
            variant.source.path.startsWith("docs/content/") &&
            variant.source.url.startsWith(
              `https://github.com/taprootio/wtfm/blob/${revision}/docs/content/`,
            ),
        ),
      ),
    ).toBe(true);
  });

  it("passes the released artifact directory validator and CLI", async () => {
    const result = await validateArtifactDirectory(firstBuild);
    expect(result.ok, JSON.stringify(result.errors ?? [])).toBe(true);

    const cli = spawnSync(process.execPath, [validateCliPath, firstBuild], {
      cwd: repositoryRoot,
      encoding: "utf-8",
    });
    expect(cli.status, cli.stderr).toBe(0);
    expect(cli.stdout).toContain("Valid Taproot Docs artifact");
  });

  it("emits stable real-document identities without fixture content", async () => {
    const manifest = JSON.parse(
      await readFile(
        path.join(firstBuild, "taproot-docs-manifest.json"),
        "utf-8",
      ),
    );
    expect(manifest.resources.map((resource) => resource.key)).toEqual(
      expectedResourceKeys,
    );
    expect(manifest.navigation[0].items.length).toBeGreaterThanOrEqual(3);
    expect(manifest.redirects).toEqual([
      {
        from: "/installation/",
        locale: "en-US",
        status: 301,
        toResourceKey: "guide:getting-started",
      },
      {
        from: "/taproot-docs-artifact/",
        locale: "en-US",
        status: 308,
        toResourceKey: "guide:taproot-docs-artifact",
      },
    ]);

    const fragmentPaths = manifest.resources.flatMap((resource) =>
      resource.variants.flatMap((variant) =>
        variant.fragments.map((fragment) => fragment.path),
      ),
    );
    const fragments = (
      await Promise.all(
        fragmentPaths.map((fragment) =>
          readFile(path.join(firstBuild, fragment), "utf-8"),
        ),
      )
    ).join("\n");
    expect(fragments).toContain("wtfm-code-block");
    expect(fragments).toContain("help-manifest.json");
    expect(fragments).toContain("taproot-docs-manifest.json");
    expect(fragments).not.toMatch(
      /Fixture home|Fixture overview|TestWidget|test-widget|taprootio\/wtfm-fixture/u,
    );
  });

  it("produces byte-identical schema-v1 artifact output across builds", async () => {
    const firstFiles = [
      "taproot-docs-manifest.json",
      ...(await walkFiles(firstBuild, "taproot-docs")),
    ];
    const secondFiles = [
      "taproot-docs-manifest.json",
      ...(await walkFiles(secondBuild, "taproot-docs")),
    ];
    expect(secondFiles).toEqual(firstFiles);

    for (const relative of firstFiles) {
      const [left, right] = await Promise.all([
        readFile(path.join(firstBuild, relative)),
        readFile(path.join(secondBuild, relative)),
      ]);
      expect(right.equals(left), relative).toBe(true);
    }
  });

  it("builds successfully with all network entry points blocked", async () => {
    await expect(access(firstNetworkLog)).rejects.toThrow();
    await expect(access(secondNetworkLog)).rejects.toThrow();
  });

  it("fails closed instead of borrowing provenance from an enclosing repository", async () => {
    const outerRepository = await mkdtemp(
      path.join(tmpdir(), "wtfm-enclosing-repository-"),
    );
    temporaryRoots.push(outerRepository);
    await writeFile(
      path.join(outerRepository, "README.md"),
      "outer repository\n",
    );
    runGit(outerRepository, ["init", "--quiet"]);
    runGit(outerRepository, ["add", "README.md"]);
    runGit(outerRepository, [
      "-c",
      "user.name=WTFM Test",
      "-c",
      "user.email=wtfm-test@example.invalid",
      "commit",
      "--quiet",
      "-m",
      "outer repository",
    ]);

    const nestedCheckout = path.join(outerRepository, "vendor", "wtfm");
    const nestedScript = path.join(nestedCheckout, "scripts", "build-docs.js");
    await mkdir(path.dirname(nestedScript), { recursive: true });
    await copyFile(docsBuildScriptPath, nestedScript);

    const result = spawnSync(process.execPath, [nestedScript], {
      cwd: nestedCheckout,
      encoding: "utf-8",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "the WTFM source directory is not its own Git worktree",
    );
  });

  it("removes retired ordinary pages before rebuilding the output directory", async () => {
    const staleBuild = await makeBuildTarget("stale");
    const stalePage = path.join(
      staleBuild.output,
      "retired-page",
      "index.html",
    );
    await mkdir(path.dirname(stalePage), { recursive: true });
    await writeFile(stalePage, "retired documentation\n");

    assertBuildSucceeded(runDocsBuild(staleBuild));
    await expect(access(stalePage)).rejects.toThrow();
  });

  it("leaves a navigable portable static site after the semantic payload is removed", async () => {
    const portableRoot = await mkdtemp(
      path.join(tmpdir(), "wtfm-portable-docs-"),
    );
    temporaryRoots.push(portableRoot);
    await cp(firstBuild, portableRoot, { recursive: true });
    await rm(path.join(portableRoot, "taproot-docs"), { recursive: true });
    await rm(path.join(portableRoot, "taproot-docs-manifest.json"));

    const files = await walkFiles(portableRoot);
    const htmlFiles = files.filter((file) => file.endsWith(".html"));
    expect(htmlFiles.length).toBe(expectedResourceKeys.length);
    expect(files).toContain("assets/site.css");
    expect(files).toContain("help-manifest.json");

    for (const relative of htmlFiles) {
      const html = await readFile(path.join(portableRoot, relative), "utf-8");
      expect(html, relative).toContain('<nav aria-label="Primary">');
      expect(html, relative).toContain('href="/assets/site.css"');
      expect(html, relative).not.toMatch(
        /(?:href|src)="\/taproot-docs(?:\/|\b)/iu,
      );
      const urls = [...html.matchAll(/(?:href|src)="([^"]+)"/gu)].map(
        (match) => match[1],
      );
      for (const url of urls) {
        const target = localTarget(portableRoot, url);
        if (target !== null) {
          await expect(
            access(target),
            `${relative} -> ${url}`,
          ).resolves.toBeUndefined();
        }
      }
    }
  });
});
