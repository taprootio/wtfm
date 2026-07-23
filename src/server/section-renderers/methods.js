import { buildDocSection } from "./build-doc-section.js";
import { buildCemContext } from "./build-cem-context.js";
import { resolveIntro } from "./resolve-intro.js";
import { renderAnchoredHeading } from "../anchors.js";

export const methodsRenderer = {
  key: "methods",
  heading: "Methods",
  intro: "`<{tagName}>` has the following methods:",
  async render(decl, options) {
    const methods =
      decl.members?.filter(
        (m) => m.kind === "method" && m.privacy == "public",
      ) ?? [];

    if (methods.length === 0) return "";

    const introText = resolveIntro(this.intro, decl.tagName, methods.length);
    const cemContext = buildCemContext(decl, options);
    const headingOffset = options.headingOffset ?? 0;
    let result = `\n${renderAnchoredHeading(2 + headingOffset, this.heading, { prefix: options.anchorPrefix })}\n\n${introText}\n\n`;

    for (const method of methods) {
      result += await buildDocSection(method.name, method.description, "", cemContext, {
        prefix: options.anchorPrefix,
        override: method.helpAnchor,
        level: 3 + headingOffset,
      });
    }
    return result;
  },
};
