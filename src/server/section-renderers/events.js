import { buildDocSection } from "./build-doc-section.js";
import { buildCemContext } from "./build-cem-context.js";
import { resolveIntro } from "./resolve-intro.js";
import { renderAnchoredHeading } from "../anchors.js";

export const eventsRenderer = {
  key: "events",
  heading: "Events",
  intro: "`<{tagName}>` emits the following events:",
  async render(decl, options) {
    if (!decl.events?.length) return "";

    const introText = resolveIntro(this.intro, decl.tagName, decl.events.length);
    const cemContext = buildCemContext(decl, options);
    let result = `\n${renderAnchoredHeading(2, this.heading, { prefix: options.anchorPrefix })}\n\n${introText}\n\n`;

    for (const event of decl.events) {
      result += await buildDocSection(
        event.name,
        event.description,
        `\`${event.name}\` is of type \`${event.type?.text || ""}\`.`,
        cemContext,
        { prefix: options.anchorPrefix, override: event.helpAnchor },
      );
    }
    return result;
  },
};
