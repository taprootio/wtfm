import { buildDocSection } from "./build-doc-section.js";
import { buildCemContext } from "./build-cem-context.js";
import { resolveIntro } from "./resolve-intro.js";

export const cssPropertiesRenderer = {
  key: "css-properties",
  heading: "CSS Properties",
  intro: "`<{tagName}>` has the following CSS properties:",
  async render(decl, options) {
    if (!decl.cssProperties?.length) return "";

    const introText = resolveIntro(
      this.intro,
      decl.tagName,
      decl.cssProperties.length,
    );
    const cemContext = buildCemContext(decl, options);
    let result = `\n## ${this.heading}\n\n${introText}\n\n`;

    for (const prop of decl.cssProperties) {
      result += await buildDocSection(prop.name, prop.description, "", cemContext);
    }
    return result;
  },
};
