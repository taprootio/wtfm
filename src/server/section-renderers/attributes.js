import { buildDocSection } from "./build-doc-section.js";
import { buildCemContext } from "./build-cem-context.js";
import { resolveIntro } from "./resolve-intro.js";

export const attributesRenderer = {
  key: "attributes",
  heading: "Attributes",
  intro: "`<{tagName}>` has the following attributes:",
  async render(decl, options) {
    const { excludeAttributes = [], attributeExceptions = {} } = options;

    const attrs =
      decl.attributes?.filter((a) => {
        if (!excludeAttributes.includes(a.name)) return true;
        const exceptions = attributeExceptions[a.name];
        return exceptions && exceptions.includes(decl.tagName);
      }) ?? [];

    if (attrs.length === 0) return "";

    const introText = resolveIntro(this.intro, decl.tagName, attrs.length);
    const cemContext = buildCemContext(decl, options);
    let result = `\n## ${this.heading}\n\n${introText}\n\n`;

    for (const attr of attrs) {
      result += await buildDocSection(
        attr.name,
        attr.description,
        `\`${attr.name}\` has a default value of \`${attr.default}\`.`,
        cemContext,
      );
    }
    return result;
  },
};
