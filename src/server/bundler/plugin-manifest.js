import { normalizeUrlPrefix } from "../urls.js";

export default function manifest(options = {}) {
  const { fileName = "manifest.json", prefix = "/dist/" } = options;
  const normalizedPrefix = normalizeUrlPrefix(prefix);

  return {
    name: "wtfm-manifest",

    generateBundle(_outputOptions, bundle) {
      const manifest = {};

      for (const [outputFileName, chunkOrAsset] of Object.entries(bundle)) {
        const originalName = chunkOrAsset.name;

        if (originalName) {
          manifest[originalName] = `${normalizedPrefix}${outputFileName}`;
        }
      }

      this.emitFile({
        type: "asset",
        fileName: fileName,
        source: JSON.stringify(manifest, null, 2),
      });
    },
  };
}
