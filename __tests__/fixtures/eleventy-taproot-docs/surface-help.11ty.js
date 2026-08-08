const helpMarkdown = `# Widget help

## Choosing a label

Keep labels short and descriptive.
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
