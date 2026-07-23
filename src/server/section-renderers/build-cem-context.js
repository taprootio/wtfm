/**
 * Builds a CEM context object for embedding in `<wtfm-code-block>`.
 * This extracts attributes, events, and slots from a CEM declaration
 * and returns a serialised context that `buildDocSection()` and the
 * eleventy-plugin can use.
 *
 * @param {object} decl - A CEM declaration object
 * @param {object} options - Plugin options
 * @param {string[]} [options.excludeAttributes=[]] - Attributes to hide
 * @param {object} [options.attributeExceptions={}] - Tag names where excluded attributes ARE shown
 * @returns {{ tagName: string, cemJson: string, pathPrefix: string }}
 */
export function buildCemContext(decl, options = {}) {
  const { excludeAttributes = [], attributeExceptions = {} } = options;

  const attrs = (decl.attributes ?? [])
    .filter((a) => {
      if (!excludeAttributes.includes(a.name)) return true;
      const exceptions = attributeExceptions[a.name];
      return exceptions && exceptions.includes(decl.tagName);
    })
    .map((a) => ({
      name: a.name,
      type: a.type?.text || "string",
      default: a.default,
    }));

  const events = (decl.events ?? []).map((e) => ({
    name: e.name,
    type: e.type?.text || "",
  }));

  const slots = (decl.slots ?? []).map((s) => ({
    name: s.name,
    description: (s.description || "").split("\n")[0],
  }));

  return {
    tagName: decl.tagName,
    pathPrefix: options.pathPrefix || "/",
    // Escape closing tags so the JSON is safe to embed inside
    // <script type="application/json">…</script>.  The HTML parser
    // treats any "</script" (case-insensitive) as the end of the
    // script block; replacing "</" with "<\/" is valid JSON and
    // prevents premature termination.
    cemJson: JSON.stringify({ attributes: attrs, events, slots }).replaceAll(
      "</",
      "<\\/",
    ),
  };
}
