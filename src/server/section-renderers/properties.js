import { buildDocSection } from "./build-doc-section.js";
import { resolveIntro } from "./resolve-intro.js";

export const propertiesRenderer = {
  key: "properties",
  heading: "Properties",
  intro: "`{name}` has the following properties:",

  async render(decl) {
    const members =
      decl.members?.filter((m) => m.kind === "field") ?? [];

    if (members.length === 0) return "";

    const introText = resolveIntro(
      this.intro,
      decl.name ?? decl.tagName,
      members.length,
    );
    let result = `\n## ${this.heading}\n\n${introText}\n\n`;

    for (const member of members) {
      // If the member has no description, synthesize one from the type.
      const description =
        member.description ||
        (member.type?.text ? `Type: \`${member.type.text}\`` : "—");

      const postDescription =
        member.type?.text && member.description
          ? `\`${member.name}\` has a type of \`${member.type.text}\`.${member.optional ? " This property is **optional**." : ""}`
          : member.optional
            ? "This property is **optional**."
            : "";

      result += await buildDocSection(
        member.name,
        description,
        postDescription,
      );
    }
    return result;
  },
};
