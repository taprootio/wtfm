/**
 * Resolves an intro template to a string. Supports both string
 * templates with {tagName} interpolation and function forms that
 * receive { tagName, count }.
 *
 * @param {string|function} intro - Template string or function
 * @param {string} tagName - The custom element tag name
 * @param {number} count - Number of items in this section
 * @returns {string} Resolved intro text
 */
export function resolveIntro(intro, tagName, count) {
  if (typeof intro === "function") {
    return intro({ tagName, count });
  }
  return intro.replace(/\{tagName\}/g, tagName);
}
