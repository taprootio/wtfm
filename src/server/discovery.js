import { readFile, realpath, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import posthtml from "posthtml";

const internal = /^\/(?:404(?:\.html)?(?:\/|$)|pagefind(?:\/|$)|taproot-docs(?:\/|$)|_.*|\.well-known(?:\/|$))/u;
const escapeXml = (value) => value.replace(/[&<>"']/gu, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);
const tokens = (value) => String(value ?? "").toLowerCase().split(/[\s,]+/u);

/** Validate configuration eagerly; an absent option keeps legacy builds unchanged. */
export function resolveDiscoveryOptions(value) {
  if (value === undefined || value === false) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("wtfm discovery: expected an options object.");
  const origin = new URL(value.origin);
  if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) {
    throw new Error("wtfm discovery: origin must be an HTTPS production origin without credentials, path, query or fragment.");
  }
  if (value.strict !== undefined && typeof value.strict !== "boolean") throw new Error("wtfm discovery: strict must be boolean.");
  const exclude = value.exclude ?? [];
  if (!Array.isArray(exclude) || exclude.some((route) => typeof route !== "string" || !route.startsWith("/") || route.startsWith("//") || /[?#\\]/u.test(route))) {
    throw new Error("wtfm discovery: exclude must contain root-relative paths; a trailing slash excludes that subtree.");
  }
  return { origin: origin.origin, strict: value.strict === true, exclude };
}

/** Parse actual elements, never metadata-looking text inside comments or scripts. */
export function discoveryMetadata(html) {
  const metadata = { icons: [], canonicals: [], noindex: false, redirect: false };
  const tree = posthtml().process(html, { sync: true, lowerCaseTags: true, lowerCaseAttributeNames: true, decodeEntities: true }).tree;
  const visit = (nodes) => { for (const node of nodes) {
    if (typeof node !== "object") continue;
    // These subtrees contain inert markup, not live discovery declarations.
    if (["template", "noscript", "textarea"].includes(node.tag)) continue;
    const attrs = node.attrs ?? {};
    if (node.tag === "meta") {
      if (["robots", "googlebot"].includes(String(attrs.name).toLowerCase()) && tokens(attrs.content).some((token) => token === "noindex" || token === "none")) metadata.noindex = true;
      if (String(attrs["http-equiv"]).toLowerCase() === "refresh") metadata.redirect = true;
    }
    if (node.tag === "link") {
      const rel = tokens(attrs.rel);
      if (rel.includes("canonical")) metadata.canonicals.push(attrs.href ?? "");
      if (rel.includes("icon") || rel.includes("apple-touch-icon")) metadata.icons.push({ href: attrs.href ?? "", type: attrs.type });
    }
    if (node.content) visit(node.content);
  } };
  visit(tree);
  return metadata;
}

function imageType(bytes) {
  if (bytes.length >= 33 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && bytes.toString("ascii", 12, 16) === "IHDR" && bytes.readUInt32BE(16) > 0 && bytes.readUInt32BE(20) > 0) return "image/png";
  if (bytes.length >= 22 && bytes.readUInt32LE(0) === 65536 && bytes.readUInt16LE(4) > 0 && bytes.length >= 6 + bytes.readUInt16LE(4) * 16) return "image/vnd.microsoft.icon";
  if (bytes.length >= 30 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP" && bytes.readUInt32LE(4) + 8 === bytes.length) return "image/webp";
  if (bytes.length >= 14 && /^GIF8[79]a/u.test(bytes.toString("ascii", 0, 6)) && bytes.readUInt16LE(6) && bytes.readUInt16LE(8)) return "image/gif";
  if (bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[bytes.length - 2] === 255 && bytes[bytes.length - 1] === 217) return "image/jpeg";
  const text = bytes.toString("utf8").replace(/^\uFEFF/u, "").replace(
    /^\s*(?:(?:<\?xml[\s\S]*?\?>|<!--[\s\S]*?-->|<!DOCTYPE\s+svg\b(?:[^>"'\[]|"[^"]*"|'[^']*'|\[[\s\S]*?\])*>)\s*)*/iu, "",
  );
  // This is a trusted producer build check, not an SVG sanitizer or decoder.
  if (/^\s*(?:<\?xml[^>]*>\s*)?<svg[\s>]/u.test(text) && /<\/svg>\s*$/u.test(text)) return "image/svg+xml";
  return null;
}

async function checkIcon(icon, options, outputDirectory) {
  if (!icon.href) throw new Error("icon declaration has an empty href");
  const url = new URL(icon.href, `${options.origin}/`);
  if (url.origin !== options.origin) throw new Error(`icon ${icon.href} is external; publish a local icon so its bytes can be verified`);
  const decoded = decodeURIComponent(url.pathname);
  if (decoded.includes("\\") || decoded.includes("\0")) throw new Error(`icon ${icon.href} has an unsafe path`);
  const root = await realpath(outputDirectory);
  const filename = await realpath(path.resolve(root, `.${decoded}`));
  if (!filename.startsWith(`${root}${path.sep}`)) throw new Error(`icon ${icon.href} escapes the output directory`);
  const info = await stat(filename);
  if (!info.isFile() || info.size > 1024 * 1024) throw new Error(`icon ${icon.href} must be a file no larger than 1 MiB`);
  const actual = imageType(await readFile(filename));
  const types = { ".png": "image/png", ".ico": "image/vnd.microsoft.icon", ".svg": "image/svg+xml", ".webp": "image/webp", ".gif": "image/gif", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" };
  const declared = icon.type === "image/x-icon" ? "image/vnd.microsoft.icon" : icon.type;
  if (!actual) throw new Error(`icon ${icon.href} has unsupported or invalid image bytes`);
  const extension = path.extname(filename).toLowerCase();
  if (types[extension] !== actual) throw new Error(`icon ${icon.href} has mismatched extension ${extension}: bytes are ${actual}, expected ${types[extension] ?? "a supported image extension"}`);
  if (declared && declared !== actual) throw new Error(`icon ${icon.href} has mismatched declared type ${declared}: bytes are ${actual}`);
}

/**
 * Generate deterministic discovery files from final Eleventy results.
 * Results require url, content and outputPath; non-HTML results are ignored.
 * Missing recommendations warn by default and fail with strict: true.
 * Broken supplied local declarations always fail. Does not rewrite HTML.
 */
export async function emitDiscovery({ results, outputDirectory, options, warn = console.warn }) {
  options = resolveDiscoveryOptions(options);
  if (!options) return { urls: [], warnings: [] };
  const urls = new Set();
  const warnings = [];
  let homepage;
  const excluded = (route) => internal.test(route) || options.exclude.some((entry) => route === entry || (entry.endsWith("/") && route.startsWith(entry)));
  for (const result of results ?? []) {
    if (!result.url || !result.outputPath?.endsWith(".html") || typeof result.content !== "string") continue;
    const url = new URL(result.url, `${options.origin}/`);
    if (url.origin !== options.origin || url.search || url.hash) throw new Error(`wtfm discovery: invalid page URL ${result.url}`);
    const metadata = discoveryMetadata(result.content);
    if (url.pathname === "/" || url.pathname === "/index.html") {
      if (homepage) throw new Error("wtfm discovery: multiple homepage outputs.");
      homepage = metadata;
      if (metadata.noindex || metadata.redirect) warnings.push("homepage is noindex or a redirect; production discovery is unavailable");
    }
    if (excluded(url.pathname) || metadata.noindex || metadata.redirect) continue;
    if (metadata.canonicals.length > 1) throw new Error(`wtfm discovery: multiple canonical declarations on ${result.url}`);
    if (metadata.canonicals.length) {
      if (!metadata.canonicals[0]) throw new Error(`wtfm discovery: empty canonical on ${result.url}`);
      const canonical = new URL(metadata.canonicals[0], url);
      if (canonical.origin !== options.origin) throw new Error(`wtfm discovery: canonical on ${result.url} points outside ${options.origin}`);
      if (canonical.href !== url.href) continue;
    }
    urls.add(url.href);
  }
  if (!homepage) warnings.push("homepage HTML output is missing");
  if (!homepage?.icons.length) warnings.push("homepage has no declared favicon; add a link rel=icon pointing to a local built image");
  for (const icon of homepage?.icons ?? []) {
    try { await checkIcon(icon, options, outputDirectory); }
    catch (error) { throw new Error(`wtfm discovery: ${error.message}`, { cause: error }); }
  }
  if (!urls.size) warnings.push("no indexable pages were found");
  if (urls.size > 50000) throw new Error("wtfm discovery: more than 50,000 pages requires a sitemap index.");
  if (warnings.length && options.strict) throw new Error(`wtfm discovery: ${warnings.join("; ")}`);
  warnings.forEach((message) => warn(`wtfm discovery: ${message}`));
  const sorted = [...urls].sort();
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sorted.map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`).join("\n")}\n</urlset>\n`;
  await writeFile(path.join(outputDirectory, "sitemap.xml"), sitemap);
  await writeFile(path.join(outputDirectory, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${options.origin}/sitemap.xml\n`);
  return { urls: sorted, warnings };
}
