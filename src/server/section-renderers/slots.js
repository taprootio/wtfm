import { buildDocSection } from "./build-doc-section.js";
import { buildCemContext } from "./build-cem-context.js";
import { resolveIntro } from "./resolve-intro.js";

export const slotsRenderer = {
  key: "slots",
  heading: "Slots",
  intro: ({ tagName, count }) =>
    count > 1
      ? `\`<${tagName}>\` has the following slots:`
      : `\`<${tagName}>\` has a slot:`,
  async render(decl, options) {
    if (!decl.slots?.length) return "";

    const introText = resolveIntro(this.intro, decl.tagName, decl.slots.length);
    const cemContext = buildCemContext(decl, options);
    let result = `\n## ${this.heading}\n\n${introText}\n\n`;

    for (const slot of decl.slots) {
      result += await buildDocSection(
        slot.name.length > 0 ? slot.name : "Default",
        slot.description,
        "",
        cemContext,
      );
    }
    return result;
  },
};
