import { describe, expect, it } from "vitest";
import {
  HELP_DOCUMENT_TAGS,
  assertHelpDocumentMarkup,
  renderHelpDocument,
} from "../src/server/help-document.js";

describe("renderHelpDocument", () => {
  it("renders the semantic help keep-list without presentation attributes", () => {
    const html = renderHelpDocument(`# Help

Paragraph with **strong**, *emphasis*, ~~removed~~, \`code\`, and a  
line break.

> Quoted help.

- one
- two

1. first
2. second

---

| Field | Meaning |
| :--- | ---: |
| Title | Heading |

\`\`\`js
const value = "<safe>";
\`\`\`

![Diagram](images/diagram.png "Discarded title")
`);

    const renderedTags = [...html.matchAll(/<\/?([a-z][a-z\d]*)\b/giu)]
      .map((match) => match[1]);
    expect(renderedTags.every((tagName) => HELP_DOCUMENT_TAGS.includes(tagName))).toBe(true);
    expect(html).toContain('<h1 id="help">Help</h1>');
    expect(html).toContain("<strong>strong</strong>");
    expect(html).toContain("<em>emphasis</em>");
    expect(html).toContain("<s>removed</s>");
    expect(html).toContain("<blockquote>");
    expect(html).toContain("<table>");
    expect(html).toContain("<pre><code>const value = &quot;&lt;safe&gt;&quot;;");
    expect(html).toContain(
      '<img src="/images/diagram.png" alt="Diagram">',
    );
    expect(html).not.toMatch(/\b(?:class|style|title|start)=/u);
  });

  it("preserves exact authored anchors and rejects duplicates", () => {
    expect(renderHelpDocument("## Title {#Title}")).toContain(
      '<h2 id="Title">Title</h2>',
    );
    expect(() =>
      renderHelpDocument("## First {#FieldName}\n\n## Second {#FieldName}"),
    ).toThrow('Duplicate anchor id "FieldName" in help document at "/"');
  });

  it("identifies the standalone document when anchors collide", () => {
    expect(() => renderHelpDocument(
      "## First {#FieldName}\n\n## Second {#FieldName}",
      { documentUrl: "/surfaces/settings/help/" },
    )).toThrow(
      'Duplicate anchor id "FieldName" in help document at "/surfaces/settings/help/"',
    );
  });

  it("removes non-id authored attributes and escapes raw HTML", () => {
    const html = renderHelpDocument(
      '## Title {#Title .presentation data-kind="unsafe"}\n\n<script>alert(1)</script>',
    );
    expect(html).toContain('<h2 id="Title">Title</h2>');
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("presentation");
    expect(html).not.toContain("data-kind");
  });

  it("resolves relative links and images from the help document route", () => {
    const html = renderHelpDocument(
      "[Sibling](../reference/) [Root](/guide/) [Field](#Title) " +
        "[External](https://example.com/help) [Mail](mailto:docs@example.com) " +
        "![Local](images/field.png) ![Data](data:image/png;base64,AAAA)",
      { documentUrl: "/surfaces/settings/help/" },
    );

    expect(html).toContain('href="/surfaces/settings/reference/"');
    expect(html).toContain('href="/guide/"');
    expect(html).toContain('href="#Title"');
    expect(html).toContain('href="https://example.com/help"');
    expect(html).toContain('href="mailto:docs@example.com"');
    expect(html).toContain('src="/surfaces/settings/help/images/field.png"');
    expect(html).toContain('src="data:image/png;base64,AAAA"');
  });

  it("fails if markup outside the help contract reaches the final assertion", () => {
    expect(() => assertHelpDocumentMarkup('<div class="wrapper">Help</div>')).toThrow(
      /disallowed <div>/,
    );
    expect(() => assertHelpDocumentMarkup('<p class="wrapper">Help</p>')).toThrow(
      /disallowed "class"/,
    );
  });
});
