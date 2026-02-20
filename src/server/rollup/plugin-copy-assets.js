import fs from "node:fs";
import path from "node:path";

export default function copyAssets(options) {
  const { src } = options;

  return {
    name: "wtfm-copy-assets",

    buildStart() {
      const processDirectory = (dir) => {
        if (!fs.existsSync(dir)) return;

        const files = fs.readdirSync(dir);

        for (const file of files) {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);

          if (stat.isDirectory()) {
            processDirectory(filePath);
          } else {
            this.addWatchFile(filePath);

            const relativePath = path.relative(src, filePath);
            // Normalize path separators for Windows compatibility
            const assetName = relativePath.split(path.sep).join("/");

            this.emitFile({
              type: "asset",
              name: assetName,
              source: fs.readFileSync(filePath),
            });
          }
        }
      };

      processDirectory(src);
    },
  };
}
