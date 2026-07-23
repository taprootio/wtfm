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

    const events = decl.events.filter((event) => {
      if (`${event.name ?? ""}`.trim()) return true;
      console.warn({
        message: "Unnamed event omitted from documentation",
        tagName: decl.tagName,
        type: event.type?.text,
      });
      return false;
    });
    if (events.length === 0) return "";

    const introText = resolveIntro(this.intro, decl.tagName, events.length);
    const cemContext = buildCemContext(decl, options);
    const headingOffset = options.headingOffset ?? 0;
    let result = `\n${renderAnchoredHeading(2 + headingOffset, this.heading, { prefix: options.anchorPrefix })}\n\n${introText}\n\n`;

    for (const event of events) {
      result += await buildDocSection(
        event.name,
        event.description,
        `\`${event.name}\` is of type \`${event.type?.text || ""}\`.`,
        cemContext,
        {
          prefix: [options.anchorPrefix, this.key],
          override: event.helpAnchor,
          level: 3 + headingOffset,
          pathPrefix: options.pathPrefix,
        },
      );
    }
    return result;
  },
};
