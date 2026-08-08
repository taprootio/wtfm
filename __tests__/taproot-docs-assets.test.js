import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import {
  collectRedirects,
  probeImage,
  resolveDeclaredAssets,
} from "../src/server/taproot-docs/assets.js";

const png = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x03,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);

const gif = Buffer.from([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61,
  0x04, 0x00, 0x05, 0x00, 0x00, 0x00,
]);

const jpeg = Buffer.from([
  0xff, 0xd8,
  0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x06, 0x00, 0x07,
  0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);

const webp = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x26, 0x00, 0x00, 0x00,
  0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x58,
  0x0a, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x07, 0x00, 0x00, 0x08, 0x00, 0x00,
]);

describe("probeImage", () => {
  it.each([
    [png, { mediaType: "image/png", width: 2, height: 3 }],
    [gif, { mediaType: "image/gif", width: 4, height: 5 }],
    [jpeg, { mediaType: "image/jpeg", width: 7, height: 6 }],
    [webp, { mediaType: "image/webp", width: 8, height: 9 }],
  ])("parses format and dimensions from real container bytes", (bytes, expected) => {
    expect(probeImage(bytes)).toMatchObject(expected);
  });

  it.each([
    [Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>")],
    [Buffer.from("plain text, definitely not an image")],
    [png.subarray(0, 12)],
    [Buffer.from([0xff, 0xd8, 0xff, 0xd9])],
  ])("returns null for unsupported or truncated bytes", (bytes) => {
    expect(probeImage(bytes)).toBeNull();
  });
});

describe("resolveDeclaredAssets", () => {
  const reader = (files) => ({
    readAssetFile(source) {
      const contents = files[source];
      if (!contents) throw new Error(`ENOENT: ${source}`);
      return contents;
    },
  });

  it("resolves declarations into manifest entries, source map, and files", () => {
    const { manifestAssets, bySource, files } = resolveDeclaredAssets(
      [
        { key: "photo-hero", source: "assets/hero.bin" },
        { key: "diagram-overview", source: "assets/overview.bin" },
      ],
      reader({ "assets/hero.bin": webp, "assets/overview.bin": png }),
    );

    expect(manifestAssets).toEqual([
      {
        key: "diagram-overview",
        path: "taproot-docs/assets/diagram-overview.png",
        mediaType: "image/png",
        bytes: png.length,
        sha256: `sha256:${createHash("sha256").update(png).digest("hex")}`,
        width: 2,
        height: 3,
      },
      {
        key: "photo-hero",
        path: "taproot-docs/assets/photo-hero.webp",
        mediaType: "image/webp",
        bytes: webp.length,
        sha256: `sha256:${createHash("sha256").update(webp).digest("hex")}`,
        width: 8,
        height: 9,
      },
    ]);
    expect(bySource.get("assets/overview.bin")).toEqual({
      key: "diagram-overview",
      width: 2,
      height: 3,
    });
    expect(files.map((file) => file.path)).toEqual([
      "taproot-docs/assets/diagram-overview.png",
      "taproot-docs/assets/photo-hero.webp",
    ]);
  });

  it("fails closed on missing files and unsupported formats", () => {
    expect(() =>
      resolveDeclaredAssets([{ key: "a", source: "missing.png" }], reader({})),
    ).toThrow(/asset "a" source "missing\.png" could not be read/u);
    expect(() =>
      resolveDeclaredAssets(
        [{ key: "a", source: "vector.svg" }],
        reader({ "vector.svg": Buffer.from("<svg/>") }),
      ),
    ).toThrow(/not a supported raster image/u);
  });

  it("rejects artifact-path collisions after key sanitization", () => {
    expect(() =>
      resolveDeclaredAssets(
        [
          { key: "a:b", source: "one.bin" },
          { key: "a-b", source: "two.bin" },
        ],
        reader({ "one.bin": png, "two.bin": png }),
      ),
    ).toThrow(/resolves to artifact path "taproot-docs\/assets\/a-b\.png", which is already used/u);
  });

  it("rejects the same source declared under two keys", () => {
    expect(() =>
      resolveDeclaredAssets(
        [
          { key: "one", source: "img.bin" },
          { key: "two", source: "img.bin" },
        ],
        reader({ "img.bin": png }),
      ),
    ).toThrow(/asset source "img\.bin" is declared more than once/u);
  });
});

describe("collectRedirects", () => {
  const documents = [
    {
      key: "guide:new",
      redirectsFrom: [
        { from: "/old-b/", status: 301 },
        { from: "/old-a/", status: 308 },
      ],
    },
    { key: "guide:other", redirectsFrom: [{ from: "/old-c/", status: 301 }] },
  ];

  it("flattens and sorts redirects deterministically", () => {
    expect(collectRedirects(documents, new Set(["/new/"]), "en-US")).toEqual([
      { from: "/old-a/", toResourceKey: "guide:new", locale: "en-US", status: 308 },
      { from: "/old-b/", toResourceKey: "guide:new", locale: "en-US", status: 301 },
      { from: "/old-c/", toResourceKey: "guide:other", locale: "en-US", status: 301 },
    ]);
  });

  it("rejects duplicate redirect sources across documents", () => {
    const duplicated = [
      { key: "guide:a", redirectsFrom: [{ from: "/old/", status: 301 }] },
      { key: "guide:b", redirectsFrom: [{ from: "/old/", status: 301 }] },
    ];
    expect(() => collectRedirects(duplicated, new Set(), "en-US"))
      .toThrow(/redirect from "\/old\/" is declared by both "guide:a" and "guide:b"/u);
  });

  it("rejects redirects that shadow a live resource route", () => {
    expect(() =>
      collectRedirects(documents, new Set(["/old-a/"]), "en-US"),
    ).toThrow(/shadows a live resource route/u);
  });
});
