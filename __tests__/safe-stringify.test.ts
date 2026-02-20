import { describe, it, expect } from "vitest";
import { safeStringify } from "../src/client/safe-stringify.js";

describe("safeStringify", () => {
  it("serializes plain objects", () => {
    expect(safeStringify({ a: 1 })).toBe(JSON.stringify({ a: 1 }, null, 2));
  });

  it("serializes null as 'null'", () => {
    expect(safeStringify(null)).toBe("null");
  });

  it("handles circular references without throwing", () => {
    const obj: Record<string, unknown> = { name: "host" };
    obj.self = obj;

    const result = safeStringify(obj);
    expect(result).toContain('"name": "host"');
    expect(result).toContain('"self": "[Circular]"');
  });

  it("replaces element-like objects with their tag name", () => {
    const el = { localName: "esp-details", nodeName: "ESP-DETAILS" };
    const detail = { openItem: el };

    const result = safeStringify(detail);
    expect(result).toContain('"openItem": "<esp-details>"');
  });

  it("handles nested circular refs (like Lit renderOptions.host)", () => {
    const host: Record<string, unknown> = {
      localName: "my-el",
      nodeName: "MY-EL",
    };
    host.renderOptions = { host };

    const result = safeStringify(host);
    expect(result).toBe('"<my-el>"');
  });

  it("handles event detail containing an element (the actual bug)", () => {
    const el = {
      localName: "esp-details-group",
      nodeName: "ESP-DETAILS-GROUP",
      renderOptions: {} as Record<string, unknown>,
    };
    el.renderOptions.host = el;
    const detail = { openItem: el };

    expect(() => safeStringify(detail)).not.toThrow();
    const result = safeStringify(detail);
    expect(result).toContain("<esp-details-group>");
  });

  it("serializes primitives in detail", () => {
    expect(safeStringify({ count: 3, label: "hello" })).toBe(
      JSON.stringify({ count: 3, label: "hello" }, null, 2),
    );
  });
});
