import { describe, it, expect } from "vitest";
import {
  collectTaprootDocsDocuments,
  validateTaprootDocsFrontMatter,
} from "../src/server/taproot-docs/documents.js";

const validBlock = {
  key: "guide:getting-started",
  kind: "guide",
  audiences: ["developer"],
};

function item(overrides = {}) {
  return {
    inputPath: "./guides/getting-started.md",
    url: "/guides/getting-started/",
    rawInput: "## Install\n",
    data: {
      title: "Getting started",
      description: "Install and run.",
      taprootDocs: validBlock,
      ...overrides.data,
    },
    ...overrides,
  };
}

function collect(items) {
  return collectTaprootDocsDocuments({ getAll: () => items });
}

describe("validateTaprootDocsFrontMatter", () => {
  it("normalizes a full block with defaults", () => {
    const validated = validateTaprootDocsFrontMatter(
      {
        ...validBlock,
        tags: ["quickstart"],
        redirectsFrom: ["/old/", { from: "/older/", status: 308 }],
        assets: [{ key: "hero", source: "assets/hero.png" }],
      },
      "doc",
    );
    expect(validated).toEqual({
      key: "guide:getting-started",
      kind: "guide",
      audiences: ["developer"],
      tags: ["quickstart"],
      description: undefined,
      redirectsFrom: [
        { from: "/old/", status: 301 },
        { from: "/older/", status: 308 },
      ],
      assets: [{ key: "hero", source: "assets/hero.png" }],
    });
  });

  it.each([
    [{ kind: "guide", audiences: ["user"] }, /taprootDocs\.key/u],
    [{ key: "a", audiences: ["user"] }, /taprootDocs\.kind/u],
    [{ key: "a", kind: "guide", audiences: [] }, /audiences may not be empty/u],
    [{ ...validBlock, audiences: ["user", "user"] }, /audiences contains duplicate "user"/u],
    [{ ...validBlock, tags: ["a", "a"] }, /tags contains duplicate "a"/u],
    [{ ...validBlock, redirectsFrom: [{ from: "/x/", status: 302 }] }, /status must be 301 or 308/u],
    [{ ...validBlock, redirectsFrom: [{ from: "/x/", to: "/y/" }] }, /unknown key 'to'/u],
    [{ ...validBlock, surprise: true }, /unknown key 'surprise'/u],
  ])("fails closed on malformed front matter %j", (block, message) => {
    expect(() => validateTaprootDocsFrontMatter(block, "doc")).toThrow(message);
  });

  it("defaults audiences to developer and canonicalizes set-like arrays", () => {
    const defaulted = validateTaprootDocsFrontMatter({ key: "a", kind: "guide" }, "doc");
    expect(defaulted.audiences).toEqual(["developer"]);

    const sorted = validateTaprootDocsFrontMatter(
      { key: "a", kind: "guide", audiences: ["user", "developer"], tags: ["zeta", "alpha"] },
      "doc",
    );
    expect(sorted.audiences).toEqual(["developer", "user"]);
    expect(sorted.tags).toEqual(["alpha", "zeta"]);
  });
});

describe("collectTaprootDocsDocuments", () => {
  it("collects opted-in Markdown documents sorted by key", () => {
    const documents = collect([
      item({
        inputPath: "./guides/z.md",
        url: "/z/",
        data: {
          title: "Z",
          description: "Z.",
          taprootDocs: { key: "guide:zebra", kind: "guide", audiences: ["user"] },
        },
      }),
      item(),
      { inputPath: "./not-opted-in.md", url: "/other/", data: { title: "Other" } },
    ]);
    expect(documents.map((doc) => doc.key)).toEqual(["guide:getting-started", "guide:zebra"]);
    expect(documents[0]).toMatchObject({
      title: "Getting started",
      description: "Install and run.",
      route: "/guides/getting-started/",
      inputPath: "guides/getting-started.md",
      rawInput: "## Install\n",
    });
  });

  it("prefers the block description over page data description", () => {
    const [doc] = collect([
      item({
        data: {
          title: "Getting started",
          description: "Page-level.",
          taprootDocs: { ...validBlock, description: "Block-level." },
        },
      }),
    ]);
    expect(doc.description).toBe("Block-level.");
  });

  it("rejects duplicate resource keys across documents", () => {
    expect(() =>
      collect([item(), item({ inputPath: "./guides/copy.md", url: "/copy/" })]),
    ).toThrow(/declared by both "guides\/getting-started\.md" and "guides\/copy\.md"/u);
  });

  it.each([
    [item({ inputPath: "./guides/page.njk" }), /Markdown documents only/u],
    [item({ data: { title: "", taprootDocs: validBlock } }), /non-empty title/u],
    [
      item({ data: { title: "T", taprootDocs: validBlock } }),
      /a description is required/u,
    ],
    [item({ url: false }), /must have a URL/u],
    [item({ rawInput: undefined }), /requires Eleventy v3/u],
  ])("fails closed on unusable documents", (badItem, message) => {
    expect(() => collect([badItem])).toThrow(message);
  });
});
