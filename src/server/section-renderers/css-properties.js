import { buildDocSection } from "./build-doc-section.js";
import { buildCemContext } from "./build-cem-context.js";
import { resolveIntro } from "./resolve-intro.js";
import { renderAnchoredHeading } from "../anchors.js";

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
    const headingOffset = options.headingOffset ?? 0;
    let result = `\n${renderAnchoredHeading(2 + headingOffset, this.heading, { prefix: options.anchorPrefix })}\n\n${introText}\n\n`;

    for (const prop of decl.cssProperties) {
      result += await buildDocSection(prop.name, prop.description, "", cemContext, {
        prefix: options.anchorPrefix,
        override: prop.helpAnchor,
        level: 3 + headingOffset,
        pathPrefix: options.pathPrefix,
      });
    }
    return result;
  },
};
