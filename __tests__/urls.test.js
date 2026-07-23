import { describe, expect, it } from "vitest";
import {
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
});
