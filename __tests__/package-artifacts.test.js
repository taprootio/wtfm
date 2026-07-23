import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const temporaryDirectories = [];
let packageJson;
let packedFiles;

beforeAll(async () => {
  const npmCacheRoot = await mkdtemp(path.join(tmpdir(), "wtfm-npm-cache-"));
  temporaryDirectories.push(npmCacheRoot);
  await execFileAsync("npm", ["run", "build"], { cwd: repositoryRoot });
  packageJson = JSON.parse(
    await readFile(path.join(repositoryRoot, "package.json"), "utf-8"),
  );
  const { stdout } = await execFileAsync(
    "npm",
    ["pack", "--dry-run", "--json", "--ignore-scripts"],
    {
      cwd: repositoryRoot,
      env: { ...process.env, npm_config_cache: npmCacheRoot },
    },
  );
  const [report] = JSON.parse(stdout);
  packedFiles = new Set(report.files.map((file) => file.path));
}, 30_000);

afterAll(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

describe("published package", () => {
  it("packs every declared concrete type target and executable", () => {
    for (const target of Object.values(packageJson.exports)) {
      if (!target.types || target.types.includes("*")) continue;
      expect(packedFiles, target.types).toContain(target.types.replace(/^\.\//u, ""));
    }
    expect(packedFiles).toContain("dist/server/check-help-anchors-cli.js");
  });

  it("resolves the new public APIs from an installed-package-shaped symlink", async () => {
    const consumerDir = await mkdtemp(path.join(tmpdir(), "wtfm-types-consumer-"));
    temporaryDirectories.push(consumerDir);
    const scopeDir = path.join(consumerDir, "node_modules/@taprootio");
    await mkdir(scopeDir, { recursive: true });
    await symlink(repositoryRoot, path.join(scopeDir, "wtfm"), "dir");
    await writeFile(
      path.join(consumerDir, "smoke.mts"),
      `import wtfmPlugin from "@taprootio/wtfm";
import { collectSurfaces } from "@taprootio/wtfm/surfaces";
import { renderHelpDocument } from "@taprootio/wtfm/help-document";
import { buildHelpManifest } from "@taprootio/wtfm/help-manifest";
import { checkHelpAnchors } from "@taprootio/wtfm/check-help-anchors";

void wtfmPlugin({}, {
  cemPath: "custom-elements.json",
  referenceUrlBuilder: (slug) => \`/reference/\${slug}/\`,
  helpUrlBuilder: (slug) => \`/help/\${slug}/\`,
});
void collectSurfaces({ modules: [] });
void renderHelpDocument("# Help");
void buildHelpManifest([], []);
void checkHelpAnchors({}, {});
`,
    );

    try {
      await execFileAsync(
        path.join(repositoryRoot, "node_modules/.bin/tsc"),
        [
          "--noEmit",
          "--module", "NodeNext",
          "--moduleResolution", "NodeNext",
          "--skipLibCheck",
          "--target", "ES2022",
          "smoke.mts",
        ],
        { cwd: consumerDir },
      );
    } catch (error) {
      throw new Error(error.stdout || error.stderr || error.message);
    }
  });
});
