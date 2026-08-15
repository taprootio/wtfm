import { execFileSync, spawnSync } from "node:child_process";
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

function parseOutputArgument(args) {
  if (args.length === 0) return path.join(repositoryRoot, "docs", "_site");
  if (args.length !== 2 || args[0] !== "--output" || args[1].length === 0) {
    fail("usage: npm run docs:build -- [--output <directory>]");
  }
  return path.resolve(repositoryRoot, args[1]);
}

const revision = gitValue(["rev-parse", "HEAD"], "source revision");
if (!/^[0-9a-f]{40}$/u.test(revision)) {
  fail("Git HEAD did not resolve to a full lowercase 40-character revision.");
}

const sourceDateEpoch = gitValue(
  ["show", "-s", "--format=%ct", "HEAD"],
  "source commit epoch",
);
if (!/^\d+$/u.test(sourceDateEpoch)) {
  fail("the Git HEAD commit epoch was not a non-negative integer.");
}

const outputDirectory = parseOutputArgument(process.argv.slice(2));
const forbiddenOutputs = [
  repositoryRoot,
  path.join(repositoryRoot, "docs"),
  path.join(repositoryRoot, "docs", "content"),
];
if (forbiddenOutputs.includes(outputDirectory)) {
  fail(`refusing unsafe output directory '${outputDirectory}'.`);
}

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
