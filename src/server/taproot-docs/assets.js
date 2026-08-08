/**
 * Declared-asset resolution for the Taproot Docs artifact (WTFM0010).
 *
 * Only explicitly declared files become artifact assets. Each declaration is
 * read from disk, its format is sniffed from the actual bytes (extensions are
 * never trusted), its dimensions are parsed from the container header, and
 * its digest and size are computed from the exact bytes that will ship. The
 * contract's four safe raster containers are the only supported formats.
 */

import { createHash } from "node:crypto";

const FORMATS = Object.freeze({
  png: { mediaType: "image/png", extension: "png" },
  jpeg: { mediaType: "image/jpeg", extension: "jpg" },
  gif: { mediaType: "image/gif", extension: "gif" },
  webp: { mediaType: "image/webp", extension: "webp" },
});

function fail(message) {
  throw new Error(`wtfm taprootDocs: ${message}`);
}

function parsePng(bytes) {
  if (bytes.length < 24) return null;
  if (bytes.toString("latin1", 12, 16) !== "IHDR") return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function parseGif(bytes) {
  if (bytes.length < 10) return null;
  return { width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8) };
}

function parseJpeg(bytes) {
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const length = bytes.readUInt16BE(offset + 2);
    if (length < 2) return null;
    const isStartOfFrame = marker >= 0xc0 && marker <= 0xcf
      && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isStartOfFrame) {
      if (offset + 9 > bytes.length) return null;
      return {
        height: bytes.readUInt16BE(offset + 5),
        width: bytes.readUInt16BE(offset + 7),
      };
    }
    if (marker === 0xda) return null;
    offset += 2 + length;
  }
  return null;
}

function parseWebp(bytes) {
  if (bytes.length < 30) return null;
  const chunk = bytes.toString("latin1", 12, 16);
  if (chunk === "VP8X") {
    return {
      width: bytes.readUIntLE(24, 3) + 1,
      height: bytes.readUIntLE(27, 3) + 1,
    };
  }
  if (chunk === "VP8 ") {
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return null;
    return {
      width: bytes.readUInt16LE(26) & 0x3fff,
      height: bytes.readUInt16LE(28) & 0x3fff,
    };
  }
  if (chunk === "VP8L") {
    if (bytes[20] !== 0x2f) return null;
    const packed = bytes.readUInt32LE(21);
    return {
      width: (packed & 0x3fff) + 1,
      height: ((packed >> 14) & 0x3fff) + 1,
    };
  }
  return null;
}

/**
 * Sniffs one of the contract's four raster formats from file bytes and
 * parses the pixel dimensions from the container header.
 *
 * @param {Buffer} bytes
 * @returns {{ mediaType: string, extension: string, width: number, height: number } | null}
 */
export function probeImage(bytes) {
  if (bytes.length >= 8 && bytes.readUInt32BE(0) === 0x89504e47 && bytes.readUInt32BE(4) === 0x0d0a1a0a) {
    const size = parsePng(bytes);
    return size && { ...FORMATS.png, ...size };
  }
  if (bytes.length >= 6 && ["GIF87a", "GIF89a"].includes(bytes.toString("latin1", 0, 6))) {
    const size = parseGif(bytes);
    return size && { ...FORMATS.gif, ...size };
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    const size = parseJpeg(bytes);
    return size && { ...FORMATS.jpeg, ...size };
  }
  if (
    bytes.length >= 16
    && bytes.toString("latin1", 0, 4) === "RIFF"
    && bytes.toString("latin1", 8, 12) === "WEBP"
  ) {
    const size = parseWebp(bytes);
    return size && { ...FORMATS.webp, ...size };
  }
  return null;
}

function artifactPathForKey(key, extension) {
  const sanitized = key.replace(/[:/]/gu, "-");
  return `taproot-docs/assets/${sanitized}.${extension}`;
}

/**
 * Resolves every declared asset into its manifest entry and shippable bytes.
 *
 * @param {Array<{ key: string, source: string }>} declarations - Merged,
 *   duplicate-free declarations (plugin config plus per-document blocks).
 * @param {{ readAssetFile(source: string): Buffer }} io - Reader rooted at the
 *   Eleventy project; throwing surfaces as a missing-file failure.
 * @returns {{
 *   manifestAssets: Array<object>,
 *   bySource: Map<string, { key: string, width: number, height: number }>,
 *   files: Array<{ path: string, contents: Buffer }>,
 * }}
 */
export function resolveDeclaredAssets(declarations, { readAssetFile }) {
  const manifestAssets = [];
  const bySource = new Map();
  const files = [];
  const byArtifactPath = new Map();

  for (const declaration of [...declarations].sort((left, right) =>
    left.key < right.key ? -1 : left.key > right.key ? 1 : 0,
  )) {
    let contents;
    try {
      contents = readAssetFile(declaration.source);
    } catch (error) {
      fail(`asset "${declaration.key}" source "${declaration.source}" could not be read: ${error.message}`);
    }
    const probed = probeImage(contents);
    if (!probed) {
      fail(`asset "${declaration.key}" source "${declaration.source}" is not a supported raster image (PNG, JPEG, GIF, or WebP).`);
    }
    const path = artifactPathForKey(declaration.key, probed.extension);
    const collision = byArtifactPath.get(path);
    if (collision !== undefined) {
      fail(`asset "${declaration.key}" resolves to artifact path "${path}", which is already used by asset "${collision}".`);
    }
    byArtifactPath.set(path, declaration.key);

    manifestAssets.push({
      key: declaration.key,
      path,
      mediaType: probed.mediaType,
      bytes: contents.length,
      sha256: `sha256:${createHash("sha256").update(contents).digest("hex")}`,
      width: probed.width,
      height: probed.height,
    });
    if (bySource.has(declaration.source)) {
      // Two keys may not ship the same source twice: it duplicates bytes and
      // makes image references ambiguous.
      fail(`asset source "${declaration.source}" is declared more than once.`);
    }
    bySource.set(declaration.source, {
      key: declaration.key,
      width: probed.width,
      height: probed.height,
    });
    files.push({ path, contents });
  }

  return { manifestAssets, bySource, files };
}

/**
 * Flattens every document's `redirectsFrom` declarations into manifest
 * redirect entries, rejecting duplicate sources and redirects that shadow a
 * live route.
 *
 * @param {Array<{ key: string, redirectsFrom: Array<{ from: string, status: number }> }>} documents
 * @param {Set<string>} liveRoutes - Canonical routes of every emitted resource.
 * @param {string} locale
 */
export function collectRedirects(documents, liveRoutes, locale) {
  const redirects = [];
  const seen = new Map();
  for (const document of documents) {
    for (const redirect of document.redirectsFrom) {
      const previous = seen.get(redirect.from);
      if (previous !== undefined) {
        fail(`redirect from "${redirect.from}" is declared by both "${previous}" and "${document.key}".`);
      }
      seen.set(redirect.from, document.key);
      if (liveRoutes.has(redirect.from)) {
        fail(`redirect from "${redirect.from}" (document "${document.key}") shadows a live resource route.`);
      }
      redirects.push({
        from: redirect.from,
        toResourceKey: document.key,
        locale,
        status: redirect.status,
      });
    }
  }
  return redirects.sort((left, right) => (left.from < right.from ? -1 : left.from > right.from ? 1 : 0));
}
