import { describe, expect, it } from "vitest";
import {
  applyPathPrefix,
  applyPathPrefixToHtml,
  normalizeUrlPrefix,
  resolveDocumentUrl,
  toRootAbsoluteUrl,
} from "../src/server/urls.js";

describe("URL helpers", () => {
  it("normalizes internal paths without adding a deployment prefix", () => {
    expect(toRootAbsoluteUrl("components/widget/?view=all#api")).toBe(
      "/components/widget/?view=all#api",
    );
    expect(toRootAbsoluteUrl("/components/widget/")).toBe(
      "/components/widget/",
    );
  });

  it("leaves external, protocol, and fragment URLs unchanged", () => {
    for (const value of [
      "https://example.com/docs",
      "mailto:docs@example.com",
      "data:image/svg+xml,test",
      "//cdn.example.com/image.png",
      "#Title",
    ]) {
      expect(toRootAbsoluteUrl(value)).toBe(value);
    }
  });

  it("resolves document-relative URLs against the help page", () => {
    expect(
      resolveDocumentUrl("../images/editor.png", "/surfaces/article/help/"),
    ).toBe("/surfaces/article/images/editor.png");
    expect(
      resolveDocumentUrl("./more/?mode=full#intro", "/surfaces/article/help/"),
    ).toBe("/surfaces/article/help/more/?mode=full#intro");
  });

  it("normalizes bundler prefixes", () => {
    expect(normalizeUrlPrefix("dist")).toBe("/dist/");
    expect(normalizeUrlPrefix("/assets/")).toBe("/assets/");
    expect(normalizeUrlPrefix("https://cdn.example.com/docs/")).toBe(
      "https://cdn.example.com/docs/",
    );
  });

  it("applies a deployment prefix only to root-absolute internal URLs", () => {
    expect(applyPathPrefix("/assets/widget.png?size=2#preview", "/help/")).toBe(
      "/help/assets/widget.png?size=2#preview",
    );
    expect(applyPathPrefix("images/widget.png", "/help/")).toBe(
      "images/widget.png",
    );
    expect(applyPathPrefix("//cdn.example.com/widget.png", "/help/")).toBe(
      "//cdn.example.com/widget.png",
    );
  });

  it("prefixes root-absolute URLs inside encoded demo HTML", async () => {
    const html = await applyPathPrefixToHtml(
      '<img src="/assets/widget.png" srcset="/assets/small.png 1x, /assets/large.png 2x"><a href="guide/">Guide</a><script>const value = \'src="/literal.png"\';</script>',
      "/help/",
    );
    expect(html).toContain('src="/help/assets/widget.png"');
    expect(html).toContain(
      'srcset="/help/assets/small.png 1x, /help/assets/large.png 2x"',
    );
    expect(html).toContain('href="guide/"');
    expect(html).toContain('src="/literal.png"');
  });
});
