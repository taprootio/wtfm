import { fileURLToPath } from "node:url";
import wtfmPlugin from "../src/server/eleventy-plugin.js";
import { navigation, taprootNavigation } from "./navigation.js";

const revision = process.env.WTFM_DOCS_REVISION;
if (!/^[0-9a-f]{40}$/u.test(revision ?? "")) {
  throw new Error(
    "wtfm docs: WTFM_DOCS_REVISION must be the explicit 40-character Git revision; use npm run docs:build.",
  );
}

export default function configureDocs(eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "docs/assets": "assets" });
  eleventyConfig.addGlobalData("site", {
    name: "WTFM Documentation",
    navigation,
    revision,
  });
  eleventyConfig.addFilter("sourceUrl", (inputPath) => {
    const sourcePath = String(inputPath ?? "").replace(/^\.\//u, "");
    return `https://github.com/taprootio/wtfm/blob/${revision}/${sourcePath}`;
  });

  eleventyConfig.addPlugin(wtfmPlugin, {
    cemPath: fileURLToPath(new URL("./custom-elements.json", import.meta.url)),
    discovery: { origin: "https://wtfm.taproot.io", strict: true },
    taprootDocs: {
      source: {
        repositoryId: "1162327960",
        repository: "taprootio/wtfm",
        revision,
        ref: "refs/heads/main",
      },
      navigation: taprootNavigation,
    },
  });

  return {
    markdownTemplateEngine: false,
    dir: {
      input: "docs/content",
      includes: "../_includes",
      output: process.env.WTFM_DOCS_OUTPUT || "docs/_site",
    },
  };
}
