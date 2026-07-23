#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { checkHelpAnchors } from "./check-help-anchors.js";

const USAGE = "Usage: wtfm-check-help-anchors <help-manifest.json> <expected-anchors.json> [--strict]";

async function readJson(filePath, label) {
  try {
    return JSON.parse(await readFile(filePath, "utf-8"));
  } catch (error) {
    throw new Error(`${label} could not be read as JSON at "${filePath}": ${error.message}`);
  }
}

/**
 * Run the help-anchor checker CLI.
 *
 * @param {string[]} [argv]
 * @param {{stdout: {write: Function}, stderr: {write: Function}}} [io]
 * @returns {Promise<number>}
 */
export async function run(argv = process.argv.slice(2), io = process) {
  const strict = argv.includes("--strict");
  const paths = argv.filter((arg) => arg !== "--strict");
  const unknownOption = paths.find((arg) => arg.startsWith("-"));
  if (paths.length !== 2 || unknownOption) {
    io.stderr.write(`${USAGE}\n`);
    return 2;
  }

  try {
    const [manifest, expected] = await Promise.all([
      readJson(paths[0], "Help manifest"),
      readJson(paths[1], "Expected anchors file"),
    ]);
    const result = checkHelpAnchors(manifest, expected, { strict });
    for (const warning of result.warnings) {
      io.stderr.write(`warning: ${warning}\n`);
    }
    for (const error of result.errors) {
      io.stderr.write(`error: ${error}\n`);
    }
    if (!result.ok) return 1;

    io.stdout.write("Help anchor contract OK.\n");
    return 0;
  } catch (error) {
    io.stderr.write(`error: ${error.message}\n`);
    return 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await run();
}
