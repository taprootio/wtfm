import { execFileSync, spawnSync } from "node:child_process";
import { lstatSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));

function fail(message) {
  process.stderr.write(`wtfm docs: ${message}\n`);
  process.exit(1);
}

function gitValue(args, description) {
  try {
    return execFileSync("git", args, {
      cwd: repositoryRoot,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    fail(`could not resolve ${description} from the checked-out Git HEAD.`);
  }
}

function parseArguments(args) {
  let outputDirectory = path.join(repositoryRoot, "docs", "_site");
  let outputSeen = false;
  let allowDirty = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--allow-dirty" && !allowDirty) {
      allowDirty = true;
      continue;
    }
    if (argument === "--output" && !outputSeen) {
      const value = args[index + 1];
      if (typeof value !== "string" || value === "" || value.startsWith("--")) {
        fail("--output requires a directory value.");
      }
      outputDirectory = path.resolve(repositoryRoot, value);
      outputSeen = true;
      index += 1;
      continue;
    }
    fail("usage: npm run docs:build -- [--allow-dirty] [--output <directory>]");
  }
  return { allowDirty, outputDirectory };
}

const actualRepositoryRoot = realpathSync(repositoryRoot);
const discoveredGitRoot = gitValue(
  ["rev-parse", "--show-toplevel"],
  "repository root",
);
let actualGitRoot;
try {
  actualGitRoot = realpathSync(discoveredGitRoot);
} catch {
  fail("the discovered Git worktree root could not be resolved.");
}
if (actualGitRoot !== actualRepositoryRoot) {
  fail(
    "the WTFM source directory is not its own Git worktree; refusing provenance from an enclosing repository.",
  );
}

const revision = gitValue(["rev-parse", "HEAD"], "source revision");
if (!/^[0-9a-f]{40}$/u.test(revision)) {
  fail("Git HEAD did not resolve to a full lowercase 40-character revision.");
}

const { allowDirty, outputDirectory } = parseArguments(process.argv.slice(2));
const workingTreeChanges = gitValue(
  ["status", "--porcelain", "--untracked-files=normal"],
  "working tree state",
);
if (workingTreeChanges !== "" && !allowDirty) {
  fail(
    "the working tree has uncommitted source changes; artifact provenance would not describe the built source. Commit the changes or pass --allow-dirty for local iteration.",
  );
}

const sourceDateEpoch = gitValue(
  ["show", "-s", "--format=%ct", revision],
  "source commit epoch",
);
if (!/^\d+$/u.test(sourceDateEpoch)) {
  fail("the Git HEAD commit epoch was not a non-negative integer.");
}

const canonicalOutput = path.join(actualRepositoryRoot, "docs", "_site");
const actualTemporaryRoot = realpathSync(tmpdir());

function pathIsInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return (
    relative === "" ||
    (relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative))
  );
}

function validateOutputDirectory(directory) {
  if (path.basename(directory) !== "_site") {
    fail("the output directory must be named '_site'.");
  }

  let parent;
  try {
    const parentStats = lstatSync(path.dirname(directory));
    if (!parentStats.isDirectory() || parentStats.isSymbolicLink()) {
      fail("the output parent must be a real directory, not a symbolic link.");
    }
    parent = realpathSync(path.dirname(directory));
  } catch (error) {
    if (error?.code !== undefined) {
      fail("the output parent must already exist as a real directory.");
    }
    throw error;
  }

  const isCanonical =
    directory === canonicalOutput && parent === path.dirname(canonicalOutput);
  const isTemporary = pathIsInside(actualTemporaryRoot, parent);
  if (!isCanonical && !isTemporary) {
    fail(
      "the output directory must be docs/_site or an _site directory under the operating-system temporary root.",
    );
  }

  try {
    const outputStats = lstatSync(directory);
    if (!outputStats.isDirectory() || outputStats.isSymbolicLink()) {
      fail(
        "the output target must be a real directory when it already exists.",
      );
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

validateOutputDirectory(outputDirectory);
rmSync(outputDirectory, { recursive: true, force: true });

const eleventyCli = path.join(
  repositoryRoot,
  "node_modules",
  "@11ty",
  "eleventy",
  "cmd.cjs",
);
const result = spawnSync(
  process.execPath,
  [eleventyCli, "--config=docs/eleventy.config.js"],
  {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      SOURCE_DATE_EPOCH: sourceDateEpoch,
      WTFM_DOCS_OUTPUT: outputDirectory,
      WTFM_DOCS_REVISION: revision,
    },
    stdio: "inherit",
  },
);

if (result.error) fail(`Eleventy could not start: ${result.error.message}`);
if (result.signal) fail(`Eleventy stopped after signal ${result.signal}.`);
if (result.status !== 0) process.exit(result.status ?? 1);
