import { readFileSync } from "node:fs";
import { collectSurfaces } from "../surfaces.js";

/**
 * Create an Eleventy data function that returns validated, pagination-ready
 * documentation surfaces from a Custom Elements Manifest.
 *
 * @param {object} options
 * @param {string} options.cemPath
 * @param {(slug: string, surface: object) => string} [options.referenceUrlBuilder]
 * @param {(slug: string, surface: object) => string} [options.helpUrlBuilder]
 * @returns {function(): object[]}
 */
export default function createSurfacesData(options = {}) {
  const { cemPath, referenceUrlBuilder, helpUrlBuilder } = options;

  return () => {
    let customElements;
    try {
      customElements = JSON.parse(readFileSync(cemPath, "utf-8"));
    } catch {
      console.warn(
        "wtfm/data/surfaces.js: Could not read custom-elements.json at",
        cemPath,
      );
      return [];
    }

    return collectSurfaces(customElements, {
      referenceUrlBuilder,
      helpUrlBuilder,
    });
  };
}
