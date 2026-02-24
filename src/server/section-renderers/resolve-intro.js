/**
 * Resolves an intro template to a string. Supports both string
 * templates with `{tagName}` / `{name}` interpolation and function
 * forms that receive `{ tagName, name, count }`.
 *
 * The `{tagName}` and `{name}` placeholders both resolve to the
 * same value — `{name}` is provided as a more natural alias for
 * non-element declarations (interfaces, type aliases, etc.).
 *
 * @param {string|function} intro - Template string or function
 * @param {string} tagName - The element tag name or type name
 * @param {number} count - Number of items in this section
 * @returns {string} Resolved intro text
 */
export function resolveIntro(intro, tagName, count) {
  if (typeof intro === "function") {
    return intro({ tagName, name: tagName, count });
  }
  return intro
    .replace(/\{tagName\}/g, tagName)
    .replace(/\{name\}/g, tagName);
}
