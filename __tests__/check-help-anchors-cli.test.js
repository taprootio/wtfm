import { afterEach, describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(
  new URL("../src/server/check-help-anchors-cli.js", import.meta.url),
);
const temporaryDirectories = [];

async function writeInputs(manifest, expected) {
  const dir = await mkdtemp(path.join(tmpdir(), "wtfm-anchor-cli-"));
  temporaryDirectories.push(dir);
  const manifestPath = path.join(dir, "help-manifest.json");
  const expectedPath = path.join(dir, "expected.json");
  await Promise.all([
    writeFile(manifestPath, JSON.stringify(manifest)),
    writeFile(expectedPath, JSON.stringify(expected)),
  ]);
  return [manifestPath, expectedPath];
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

describe("wtfm-check-help-anchors CLI", () => {
  it("exits zero for matching inputs", async () => {
    const paths = await writeInputs(
      {
        schemaVersion: 1,
        surfaces: [{
          slug: "settings",
          referenceUrl: "/settings/",
          helpUrl: "/settings/help/",
          anchors: ["Title"],
        }],
      },
      { schemaVersion: 1, surfaces: { settings: ["Title"] } },
    );
    const result = await execFileAsync(process.execPath, [cliPath, ...paths]);
    expect(result.stdout).toContain("Help anchor contract OK.");
    expect(result.stderr).toBe("");
  });

  it("exits non-zero with missing-anchor diagnostics", async () => {
    const paths = await writeInputs(
      {
        schemaVersion: 1,
        surfaces: [{
          slug: "settings",
          referenceUrl: "/settings/",
          helpUrl: "/settings/help/",
          anchors: [],
        }],
      },
      { schemaVersion: 1, surfaces: { settings: ["Title"] } },
    );

    await expect(execFileAsync(process.execPath, [cliPath, ...paths])).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining('missing expected anchor "Title"'),
    });
  });

  it("runs through an npm-style executable symlink", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "wtfm-anchor-cli-link-"));
    temporaryDirectories.push(dir);
    const linkedCli = path.join(dir, "wtfm-check-help-anchors");
    await symlink(cliPath, linkedCli);

    await expect(execFileAsync(process.execPath, [linkedCli])).rejects.toMatchObject({
      code: 2,
      stderr: expect.stringContaining("Usage:"),
    });
  });

  it("uses exit code 2 for malformed JSON or arguments", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "wtfm-anchor-cli-"));
    temporaryDirectories.push(dir);
    const malformedPath = path.join(dir, "malformed.json");
    await writeFile(malformedPath, "{");

    await expect(
      execFileAsync(process.execPath, [cliPath, malformedPath, malformedPath]),
    ).rejects.toMatchObject({ code: 2 });
    await expect(execFileAsync(process.execPath, [cliPath])).rejects.toMatchObject({
      code: 2,
      stderr: expect.stringContaining("Usage:"),
    });
  });
});
