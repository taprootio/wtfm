/** JSON.stringify that handles circular refs and DOM elements. */
export function safeStringify(value: unknown): string {
  const seen = new WeakSet();
  return JSON.stringify(
    value,
    (_key, val) => {
      if (isElement(val)) return `<${val.localName}>`;
      if (typeof val === "object" && val !== null) {
        if (seen.has(val)) return "[Circular]";
        seen.add(val);
      }
      return val;
    },
    2,
  );
}

/** Duck-type check so this works without a DOM global. */
function isElement(val: unknown): val is { localName: string } {
  return (
    typeof val === "object" &&
    val !== null &&
    "localName" in val &&
    typeof (val as Record<string, unknown>).localName === "string" &&
    "nodeName" in val
  );
}
