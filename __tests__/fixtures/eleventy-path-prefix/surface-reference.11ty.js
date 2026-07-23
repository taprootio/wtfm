export const data = {
  pagination: {
    data: "docSurfaces",
    size: 1,
    alias: "surface",
  },
  permalink: (data) => data.surface.referenceUrl,
};

export default async function (data) {
  const markdown = await this.renderSurfaceDocs(data.surface.slug);
  return `<!doctype html>
<html lang="en">
  <body>
    <h1>${data.surface.pageTitle} reference</h1>
    ${this.renderMarkdown(markdown)}
  </body>
</html>`;
}
