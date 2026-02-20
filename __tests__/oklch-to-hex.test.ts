import { describe, it, expect } from "vitest";
import {
  oklchToHex,
  parseOklchString,
  normalizeToHex,
} from "../src/client/oklch-to-hex.js";

describe("oklchToHex", () => {
  it("converts black (L=0)", () => {
    expect(oklchToHex({ l: 0, c: 0, h: 0 })).toBe("#000000");
  });

  it("converts white (L=1)", () => {
    expect(oklchToHex({ l: 1, c: 0, h: 0 })).toBe("#ffffff");
  });

  it("converts a mid-gray (L≈0.53, achromatic)", () => {
    const hex = oklchToHex({ l: 0.533, c: 0, h: 0 });
    // Should be near #777777 — allow some tolerance
    expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    const r = parseInt(hex.slice(1, 3), 16);
    expect(r).toBeGreaterThan(100);
    expect(r).toBeLessThan(140);
  });

  it("converts a saturated color", () => {
    // oklch(0.7 0.15 150) — a greenish color
    const hex = oklchToHex({ l: 0.7, c: 0.15, h: 150 });
    expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    // Green channel should dominate
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    expect(g).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(b);
  });

  it("handles hue > 360 by wrapping", () => {
    const a = oklchToHex({ l: 0.7, c: 0.1, h: 30 });
    const b = oklchToHex({ l: 0.7, c: 0.1, h: 390 });
    expect(a).toBe(b);
  });

  it("clamps out-of-gamut values", () => {
    // Very high chroma may push sRGB out of range
    const hex = oklchToHex({ l: 0.5, c: 0.4, h: 270 });
    expect(hex).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("parseOklchString", () => {
  it("parses a valid oklch() string", () => {
    const result = parseOklchString("oklch(0.5 0.2 120)");
    expect(result).toEqual({ l: 0.5, c: 0.2, h: 120 });
  });

  it("handles extra whitespace", () => {
    const result = parseOklchString("  oklch(  0.5  0.2  120  )  ");
    expect(result).toEqual({ l: 0.5, c: 0.2, h: 120 });
  });

  it("returns null for non-oklch strings", () => {
    expect(parseOklchString("#ff0000")).toBeNull();
    expect(parseOklchString("rgb(255,0,0)")).toBeNull();
    expect(parseOklchString("hello")).toBeNull();
  });

  it("returns null for oklch with alpha (unsupported)", () => {
    expect(parseOklchString("oklch(0.5 0.2 120 / 0.5)")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseOklchString("")).toBeNull();
  });
});

describe("normalizeToHex", () => {
  it("returns hex strings as-is", () => {
    expect(normalizeToHex("#ff0000")).toBe("#ff0000");
    expect(normalizeToHex("#abcdef")).toBe("#abcdef");
  });

  it("converts oklch strings to hex", () => {
    const result = normalizeToHex("oklch(0 0 0)");
    expect(result).toBe("#000000");
  });

  it("falls back for unrecognized formats", () => {
    expect(normalizeToHex("rgb(255,0,0)")).toBe("rgb(255,0,0)");
    expect(normalizeToHex("red")).toBe("red");
  });
});
