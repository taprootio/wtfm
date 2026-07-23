import { buildDocSection } from "./build-doc-section.js";
import { resolveIntro } from "./resolve-intro.js";
import { renderAnchoredHeading } from "../anchors.js";

export const parametersRenderer = {
  key: "parameters",
  heading: "Parameters",
  intro: "`{name}` accepts the following parameters:",

  async render(decl, options = {}) {
    const params = decl.parameters ?? [];
    if (params.length === 0) return "";

    const introText = resolveIntro(
      this.intro,
      decl.name ?? decl.tagName,
      params.length,
    );
    const headingOffset = options.headingOffset ?? 0;
    let result = `\n${renderAnchoredHeading(2 + headingOffset, this.heading, { prefix: options.anchorPrefix })}\n\n${introText}\n\n`;

    for (const param of params) {
      const description =
        param.description ||
        (param.type?.text ? `Type: \`${param.type.text}\`` : "—");

      const postParts = [];
      if (param.type?.text && param.description) {
        postParts.push(`\`${param.name}\` has a type of \`${param.type.text}\`.`);
      }
      if (param.optional) {
        postParts.push("This parameter is **optional**.");
      }
      if (param.default) {
        postParts.push(`Default value: \`${param.default}\`.`);
      }

      result += await buildDocSection(
        param.name,
        description,
        postParts.join(" "),
        null,
        {
          prefix: options.anchorPrefix,
          override: param.helpAnchor,
          level: 3 + headingOffset,
          pathPrefix: options.pathPrefix,
        },
      );
    }
    return result;
  },
};
