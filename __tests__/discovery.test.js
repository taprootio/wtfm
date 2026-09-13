import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { emitDiscovery, resolveDiscoveryOptions } from "../src/server/discovery.js";

const temporary = [];
afterEach(async () => { await Promise.all(temporary.splice(0).map((p) => rm(p, { recursive: true, force: true }))); });
const page = (url, content = "") => ({ url, outputPath: `${url.endsWith("/") ? `${url}index` : url}.html`, content });
const home = '<html><head><link rel="icon" href="/icon.svg" type="image/svg+xml"></head><body>Docs</body></html>';
async function fixture() {
  const outputDirectory = await mkdtemp(path.join(os.tmpdir(), "wtfm-discovery-")); temporary.push(outputDirectory);
  await writeFile(path.join(outputDirectory, "icon.svg"), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><path d="M0 0h96v96H0z"/></svg>');
  return { outputDirectory, options: { origin: "https://docs.example.com", strict: true }, results: [page("/", home)] };
}

describe("portable discovery", () => {
  it("emits sorted, escaped canonical pages and robots, excluding metadata and internal routes", async () => {
    const input = await fixture();
    input.results.push(page("/z/"), page("/a&b/"), page("/404.html"), page("/pagefind/index.html"), page("/taproot-docs/x.html"), page("/hidden/", '<meta name="robots" content="noindex,follow">'), page("/old/", '<meta http-equiv="refresh" content="0;url=/">'), page("/alias/", '<link rel="canonical" href="/">'));
    input.results.push(page("/real/", '<!-- <meta name="robots" content="noindex"> --><script>const x = \'<meta name="robots" content="noindex">\';</script>'));
    const result = await emitDiscovery(input);
    expect(result.urls).toEqual(["https://docs.example.com/", "https://docs.example.com/a&b/", "https://docs.example.com/real/", "https://docs.example.com/z/"]);
    const sitemap = await readFile(path.join(input.outputDirectory, "sitemap.xml"), "utf8");
    expect(sitemap).toContain("<loc>https://docs.example.com/a&amp;b/</loc>");
    expect(await readFile(path.join(input.outputDirectory, "robots.txt"), "utf8")).toBe("User-agent: *\nAllow: /\n\nSitemap: https://docs.example.com/sitemap.xml\n");
    await emitDiscovery({ ...input, results: [...input.results].reverse() });
    expect(await readFile(path.join(input.outputDirectory, "sitemap.xml"), "utf8")).toBe(sitemap);
  });
  it("ignores inert metadata and decodes canonical attribute entities", async () => {
    const input = await fixture();
    for (const tag of ["template", "noscript", "textarea"]) {
      input.results.push(page(`/${tag}/`, `<${tag}><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0;url=/"><link rel="canonical" href="https://wrong.example/"></${tag}>`));
    }
    input.results.push(page("/a&b/", '<link rel="canonical" href="/a&amp;b/">'));
    expect((await emitDiscovery(input)).urls).toEqual([
      "https://docs.example.com/", "https://docs.example.com/a&b/",
      "https://docs.example.com/noscript/", "https://docs.example.com/template/", "https://docs.example.com/textarea/",
    ]);
  });
  it("accepts SVG exports with XML comments and a doctype prolog", async () => {
    const input = await fixture();
    const icon = path.join(input.outputDirectory, "icon.svg");
    const svg = await readFile(icon, "utf8");
    await writeFile(icon, '<?xml version="1.0"?>\n<!-- Exported by a vector editor -->\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n' + svg);
    expect((await emitDiscovery(input)).warnings).toEqual([]);
  });
  it("identifies PNG bytes stored under an ICO extension", async () => {
    const input = await fixture();
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6SAAAAABJRU5ErkJggg==", "base64");
    await writeFile(path.join(input.outputDirectory, "favicon.ico"), png);
    input.results[0].content = '<link rel="icon" href="/favicon.ico">';
    await expect(emitDiscovery(input)).rejects.toThrow(/extension .ico: bytes are image\/png, expected image\/vnd.microsoft.icon/);
  });
  it("applies exact and subtree exclusions without excluding similar prefixes", async () => {
    const input = await fixture(); input.options.exclude = ["/private/", "/one.html"];
    input.results.push(...["/private/child/", "/privateer/", "/one.html", "/one.html/child/"].map((url) => page(url)));
    expect((await emitDiscovery(input)).urls).toEqual(["https://docs.example.com/", "https://docs.example.com/one.html/child/", "https://docs.example.com/privateer/"]);
  });
  it.each([['missing file', '<link rel="icon" href="/missing.png">', /ENOENT/], ['wrong declared type', '<link rel="icon" href="/icon.svg" type="image/png">', /mismatched/], ['empty href', '<link rel="icon">', /empty href/], ['wrong origin', '<link rel="canonical" href="https://staging.example.com/"><link rel="icon" href="/icon.svg">', /outside/]])("rejects %s", async (_name, markup, error) => {
    const input = await fixture(); input.results = [page("/", markup)];
    await expect(emitDiscovery(input)).rejects.toThrow(error);
  });
  it("rejects HTML masquerading as an icon", async () => {
    const input = await fixture(); await writeFile(path.join(input.outputDirectory, "icon.svg"), "<!doctype html><h1>Not found</h1>");
    await expect(emitDiscovery(input)).rejects.toThrow(/unsupported or invalid image bytes/);
  });
  it("warns for absent recommendations and fails them in strict mode", async () => {
    const input = await fixture(); input.results = [page("/", "<h1>No icon</h1>")]; input.options.strict = false;
    const messages = []; await emitDiscovery({ ...input, warn: (message) => messages.push(message) });
    expect(messages).toHaveLength(1); expect(messages[0]).toMatch(/no declared favicon/);
    input.options.strict = true; await expect(emitDiscovery(input)).rejects.toThrow(/no declared favicon/);
  });
  it("fails an accidentally nonindexable production home in strict mode", async () => {
    const input = await fixture(); input.results[0].content = '<meta name="googlebot" content="none">' + home;
    await expect(emitDiscovery(input)).rejects.toThrow(/homepage is noindex/);
  });
  it("does not require a root favicon.ico when a valid icon is declared", async () => {
    expect((await emitDiscovery(await fixture())).warnings).toEqual([]);
  });
  it("validates configuration and is opt-in", () => {
    expect(resolveDiscoveryOptions(undefined)).toBeNull();
    for (const origin of ["http://docs.example.com", "https://docs.example.com/path", "https://user@docs.example.com", "https://docs.example.com?x=1"]) expect(() => resolveDiscoveryOptions({ origin })).toThrow();
    expect(() => resolveDiscoveryOptions({ origin: "https://docs.example.com", strict: "true" })).toThrow(/boolean/);
  });
});
