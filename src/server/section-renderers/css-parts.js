import { buildDocSection } from "./build-doc-section.js";
import { buildCemContext } from "./build-cem-context.js";
import { resolveIntro } from "./resolve-intro.js";

export const cssPartsRenderer = {
  key: "css-parts",
  heading: "CSS Parts",
  intro: ({ tagName, count }) =>
    count > 1
      ? `\`<${tagName}>\` has the following CSS parts:`
      : `\`<${tagName}>\` has a CSS part:`,
  async render(decl, options) {
    if (!decl.cssParts?.length) return "";

    const introText = resolveIntro(
      this.intro,
      decl.tagName,
      decl.cssParts.length,
    );
    const cemContext = buildCemContext(decl, options);
    let result = `\n## ${this.heading}\n\n${introText}\n\n`;

    for (const part of decl.cssParts) {
      result += await buildDocSection(part.name, part.description, "", cemContext);
    }
    return result;
  },
};
