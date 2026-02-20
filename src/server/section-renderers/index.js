export { buildDocSection } from "./build-doc-section.js";
export { buildCemContext } from "./build-cem-context.js";
export { resolveIntro } from "./resolve-intro.js";
export { slotsRenderer } from "./slots.js";
export { attributesRenderer } from "./attributes.js";
export { methodsRenderer } from "./methods.js";
export { eventsRenderer } from "./events.js";
export { cssPartsRenderer } from "./css-parts.js";
export { cssPropertiesRenderer } from "./css-properties.js";

import { slotsRenderer } from "./slots.js";
import { attributesRenderer } from "./attributes.js";
import { methodsRenderer } from "./methods.js";
import { eventsRenderer } from "./events.js";
import { cssPartsRenderer } from "./css-parts.js";
import { cssPropertiesRenderer } from "./css-properties.js";

/**
 * The default section renderers in their standard order.
 * Consumers can import this to reference, reorder, or extend.
 */
export const defaultRenderers = [
  slotsRenderer,
  attributesRenderer,
  methodsRenderer,
  eventsRenderer,
  cssPartsRenderer,
  cssPropertiesRenderer,
];
