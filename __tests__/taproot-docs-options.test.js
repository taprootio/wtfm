import { describe, it, expect } from "vitest";
import {
  resolveTaprootDocsOptions,
  validateAssetDeclarations,
} from "../src/server/taproot-docs/options.js";

/** A complete explicit source block that needs no environment fallbacks. */
const explicitSource = {
  repositoryId: "R_kgDOexample",
  repository: "taprootio/docs-fixture",
  revision: "0123456789abcdef0123456789abcdef01234567",
  ref: "refs/heads/main",
};

const baseOptions = { source: explicitSource, navigation: [] };

/** Environment double: no CI variables, no SOURCE_DATE_EPOCH. */
const emptyEnv = {};

function resolve(overrides = {}, env = emptyEnv) {
  return resolveTaprootDocsOptions({ ...baseOptions, ...overrides }, { env });
}

describe("resolveTaprootDocsOptions", () => {
  it("returns null when the block is absent so the mode stays opt-in", () => {
    expect(resolveTaprootDocsOptions(undefined, { env: emptyEnv })).toBeNull();
    expect(resolveTaprootDocsOptions(null, { env: emptyEnv })).toBeNull();
  });

  it("resolves an explicit configuration with defaults applied", () => {
    const resolved = resolve();
    expect(resolved).toEqual({
      source: {
        provider: "github",
        repositoryId: "R_kgDOexample",
        repository: "taprootio/docs-fixture",
        repositoryUrl: "https://github.com/taprootio/docs-fixture",
        revision: "0123456789abcdef0123456789abcdef01234567",
        ref: "refs/heads/main",
      },
      ciEnvironment: false,
      defaultLocale: "en-US",
      localeLabel: "English",
      navigation: [],
      assets: [],
      sourceDateEpoch: null,
    });
  });

  it("fills provenance from GITHUB_* variables only when ciEnvironment is enabled", () => {
    const env = {
      GITHUB_REPOSITORY_ID: "123456789",
      GITHUB_REPOSITORY: "taprootio/docs-fixture",
      GITHUB_SHA: "0123456789abcdef0123456789abcdef01234567",
      GITHUB_REF: "refs/tags/docs-v1",
    };
    const resolved = resolveTaprootDocsOptions(
      { source: {}, ciEnvironment: true, navigation: [] },
      { env },
    );
    expect(resolved.source.repositoryId).toBe("123456789");
    expect(resolved.source.repository).toBe("taprootio/docs-fixture");
    expect(resolved.source.repositoryUrl).toBe("https://github.com/taprootio/docs-fixture");
    expect(resolved.source.revision).toBe("0123456789abcdef0123456789abcdef01234567");
    expect(resolved.source.ref).toBe("refs/tags/docs-v1");

    expect(() =>
      resolveTaprootDocsOptions({ source: {}, navigation: [] }, { env }),
    ).toThrow(/source\.repositoryId is required/u);
  });

  it("prefers explicit source values over CI environment fallbacks", () => {
    const env = { GITHUB_REPOSITORY_ID: "environment-id" };
    const resolved = resolveTaprootDocsOptions(
      { source: explicitSource, ciEnvironment: true, navigation: [] },
      { env },
    );
    expect(resolved.source.repositoryId).toBe("R_kgDOexample");
  });

  it.each([
    ["repositoryId"],
    ["repository"],
    ["revision"],
    ["ref"],
  ])("fails closed when source.%s cannot be resolved", (field) => {
    const source = { ...explicitSource };
    delete source[field];
    expect(() =>
      resolveTaprootDocsOptions({ source, navigation: [] }, { env: emptyEnv }),
    ).toThrow(new RegExp(`source\\.${field} is required`, "u"));
  });

  it("rejects non-GitHub providers for the v1 contract", () => {
    expect(() => resolve({ source: { ...explicitSource, provider: "gitlab" } }))
      .toThrow(/provider must be "github"/u);
  });

  it("rejects unknown option and source keys", () => {
    expect(() => resolve({ unexpected: true })).toThrow(/unknown option 'unexpected'/u);
    expect(() => resolve({ source: { ...explicitSource, branch: "main" } }))
      .toThrow(/source has unknown key 'branch'/u);
  });

  it("requires the navigation key and validates node shapes recursively", () => {
    expect(() =>
      resolveTaprootDocsOptions({ source: explicitSource }, { env: emptyEnv }),
    ).toThrow(/navigation is required/u);
    expect(() => resolve({ navigation: [{ resourceKey: "guide:a" }] }))
      .toThrow(/navigation\[0\]\.label/u);
    expect(() =>
      resolve({ navigation: [{ label: "Guides", children: [{ label: "" }] }] }),
    ).toThrow(/navigation\[0\]\.children\[0\]\.label/u);
    expect(() => resolve({ navigation: [{ label: "X", href: "/x/" }] }))
      .toThrow(/unknown key 'href'/u);
  });

  it("resolves sourceDateEpoch from config, then SOURCE_DATE_EPOCH, else defers", () => {
    expect(resolve({ sourceDateEpoch: 1767225600 }).sourceDateEpoch).toBe(1767225600);
    expect(resolve({}, { SOURCE_DATE_EPOCH: "1767225600" }).sourceDateEpoch).toBe(1767225600);
    expect(resolve().sourceDateEpoch).toBeNull();
    expect(() => resolve({ sourceDateEpoch: -1 })).toThrow(/non-negative integer/u);
    expect(() => resolve({ sourceDateEpoch: 1.5 })).toThrow(/non-negative integer/u);
    expect(() => resolve({}, { SOURCE_DATE_EPOCH: "soon" })).toThrow(/SOURCE_DATE_EPOCH/u);
  });
});

describe("validateAssetDeclarations", () => {
  it("normalizes a leading ./ and preserves declaration order", () => {
    const validated = validateAssetDeclarations(
      [
        { key: "diagram-overview", source: "./assets/overview.png" },
        { key: "photo-hero", source: "assets/hero.webp" },
      ],
      "assets",
    );
    expect(validated).toEqual([
      { key: "diagram-overview", source: "assets/overview.png" },
      { key: "photo-hero", source: "assets/hero.webp" },
    ]);
  });

  it.each([
    [{ key: "a", source: "/etc/passwd" }, /project-relative/u],
    [{ key: "a", source: "C:/windows/img.png" }, /project-relative/u],
    [{ key: "a", source: "~/img.png" }, /project-relative/u],
    [{ key: "a", source: "../outside.png" }, /'\.\.' segments/u],
    [{ key: "a", source: "assets/../../outside.png" }, /'\.\.' segments/u],
    [{ key: "a", source: "assets\\img.png" }, /forward slashes/u],
    [{ key: "a", source: "" }, /non-empty string/u],
    [{ key: "", source: "assets/img.png" }, /non-empty string/u],
    [{ key: "a", source: "img.png", extra: 1 }, /unknown key 'extra'/u],
  ])("rejects unsafe or malformed declaration %j", (declaration, message) => {
    expect(() => validateAssetDeclarations([declaration], "assets")).toThrow(message);
  });

  it("rejects duplicate asset keys across the list", () => {
    expect(() =>
      validateAssetDeclarations(
        [
          { key: "logo", source: "a.png" },
          { key: "logo", source: "b.png" },
        ],
        "assets",
      ),
    ).toThrow(/duplicates asset key 'logo'.*assets\[0\]/u);
  });
});
