const helpMarkdown = `# Settings help

## Title {#Title}

Choose a useful title. [Read the guide](../../../guide/).

## Advanced options

![Settings diagram](images/settings.png)
`;

export const data = {
  pagination: {
    data: "docSurfaces",
    size: 1,
    alias: "surface",
  },
  permalink: (data) => data.surface.helpUrl,
};

export default function (data) {
  return `<!doctype html>
<html lang="en">
  <body>
    ${this.renderHelpDocs(data.surface.slug, helpMarkdown)}
  </body>
</html>`;
}
