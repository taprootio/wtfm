/**
 * Self-contained OKLCH → hex converter for WTFM.
 *
 * Pure math, no external dependencies. Converts oklch() color
 * strings to #RRGGBB hex via OKLab → linear RGB → gamma sRGB.
 */

const DEG = Math.PI / 180;

interface OklchColor {
  l: number;
  c: number;
  h: number;
}

function oklchToOklab(color: OklchColor) {
  const hRad = color.h * DEG;
  return {
    L: color.l,
    a: color.c * Math.cos(hRad),
    b: color.c * Math.sin(hRad),
  };
}

function oklabToLinearRGB(lab: { L: number; a: number; b: number }) {
  const l_ = lab.L + 0.3963377774 * lab.a + 0.2158037573 * lab.b;
  const m_ = lab.L - 0.1055613458 * lab.a - 0.0638541728 * lab.b;
  const s_ = lab.L - 0.0894841775 * lab.a - 1.291485548 * lab.b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  return {
    r: +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  };
}

function linearToGamma(c: number): number {
  if (c <= 0.0031308) return 12.92 * c;
  return 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

function toHexChannel(v: number): string {
  const byte = Math.round(clamp(v, 0, 1) * 255);
  return byte.toString(16).padStart(2, "0");
}

/**
 * Convert an OKLCH color to a #RRGGBB hex string.
 * Out-of-gamut values are clamped to sRGB.
 */
export function oklchToHex(color: OklchColor): string {
  const lab = oklchToOklab(color);
  const lin = oklabToLinearRGB(lab);
  const r = linearToGamma(lin.r);
  const g = linearToGamma(lin.g);
  const b = linearToGamma(lin.b);
  return `#${toHexChannel(r)}${toHexChannel(g)}${toHexChannel(b)}`;
}

/**
 * Parse an `oklch(L C H)` string into its components.
 * Returns `null` if the string is not a valid oklch() expression.
 */
export function parseOklchString(
  str: string,
): OklchColor | null {
  const match = str.trim().match(
    /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/,
  );
  if (!match) return null;
  return {
    l: parseFloat(match[1]),
    c: parseFloat(match[2]),
    h: parseFloat(match[3]),
  };
}

/**
 * Normalize a color string to hex. Accepts either a #RRGGBB hex
 * string (returned as-is) or an oklch() string (converted to hex).
 */
export function normalizeToHex(color: string): string {
  if (color.startsWith("#")) return color;
  const parsed = parseOklchString(color);
  if (parsed) return oklchToHex(parsed);
  return color; // fallback: return as-is
}
