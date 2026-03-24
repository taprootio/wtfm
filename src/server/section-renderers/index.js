export { buildDocSection } from "./build-doc-section.js";
export { buildCemContext } from "./build-cem-context.js";
export { resolveIntro } from "./resolve-intro.js";
export { slotsRenderer } from "./slots.js";
export { attributesRenderer } from "./attributes.js";
export { methodsRenderer } from "./methods.js";
export { eventsRenderer } from "./events.js";
export { cssPartsRenderer } from "./css-parts.js";
export { cssPropertiesRenderer } from "./css-properties.js";
export { propertiesRenderer } from "./properties.js";
export { parametersRenderer } from "./parameters.js";
export { examplesRenderer } from "./examples.js";

import { slotsRenderer } from "./slots.js";
import { attributesRenderer } from "./attributes.js";
import { methodsRenderer } from "./methods.js";
import { eventsRenderer } from "./events.js";
import { cssPartsRenderer } from "./css-parts.js";
import { cssPropertiesRenderer } from "./css-properties.js";
import { propertiesRenderer } from "./properties.js";
import { parametersRenderer } from "./parameters.js";
import { examplesRenderer } from "./examples.js";

/**
 * The default section renderers for component declarations,
 * in their standard order.
 * Consumers can import this to reference, reorder, or extend.
 */
export const defaultRenderers = [
  examplesRenderer,
  slotsRenderer,
  attributesRenderer,
  methodsRenderer,
  eventsRenderer,
  cssPartsRenderer,
  cssPropertiesRenderer,
];

/**
 * Section renderers for non-component type declarations
 * (interfaces, type aliases, const objects, functions).
 * Registered automatically alongside `defaultRenderers` so
 * they are available in the renderer map.
 */
export const typeRenderers = [
  propertiesRenderer,
  parametersRenderer,
];

/**
 * Default section keys per declaration kind. Used when a type
 * declaration does not specify `@docSections`.
 */
export const defaultTypeSections = {
  interface: ["properties"],
  "type-alias": [],
  variable: ["properties"],
  function: ["parameters"],
};
