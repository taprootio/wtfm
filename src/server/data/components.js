import { readFileSync } from "fs";

/**
 * Combines the split tag value from @wc-toolkit/jsdoc-tags.
 * The plugin splits "Color Picker" into { name: "Color", description: "Picker" }.
 */
function tagValue(tag) {
  if (!tag) return undefined;
  return [tag.name, tag.description].filter(Boolean).join(" ");
}

/**
 * Extracts the first sentence from a JSDoc description for use as metaDescription.
 * Strips markdown links/backticks and stops at the first period followed by whitespace.
 */
function firstSentence(description) {
  if (!description) return "";
  // Strip markdown links: [text](url) → text, and backticks
  const plain = description
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`/g, "");
  // Collapse whitespace then match first sentence ending with a period
  const collapsed = plain.replace(/\s+/g, " ").trim();
  const match = collapsed.match(/^(.+?\.)\s/);
  return match ? match[1] : collapsed.split(".")[0] + ".";
}

/**
 * Builds breadcrumb trail from the URL path.
 * "/components/checkbox" → [Components, Checkbox]
 * "/components/checkbox/group" → [Components, Checkbox, Checkbox group]
 * "/components/pickers/pick-some" → [Components, Pickers, Pick some]
 */
function buildCrumbs(url, pageTitle, allComponents) {
  const crumbs = [{ label: "Components", url: "/components" }];
  const segments = url.replace(/^\/components\//, "").split("/");

  if (segments.length > 1) {
    // This is a sub-component — find the parent.
    // First try exact match at /components/{group}
    const parentUrl = "/components/" + segments[0];
    let parent = allComponents.find((c) => c.url === parentUrl);

    // If no exact match, find the menu-level component in this group
    // (e.g., pickers: pick-one has menuLabel "Pickers" at /components/pickers/pick-one)
    // Exclude self to avoid duplicate breadcrumbs.
    if (!parent) {
      parent = allComponents.find(
        (c) => c.url !== url && c.url.startsWith(parentUrl + "/") && c.menuLabel,
      );
    }

    if (parent) {
      crumbs.push({ label: parent.menuLabel || parent.pageTitle, url: parent.url });
    }
  }

  crumbs.push({ label: pageTitle, url });
  return crumbs;
}

/**
 * Creates an Eleventy data function that reads a Custom Elements
 * Manifest and returns a pagination-ready array of component objects.
 *
 * @param {object} options
 * @param {string} options.cemPath - Absolute path to custom-elements.json
 * @returns {function} Eleventy data function
 */
export default function createComponentsData(options = {}) {
  const { cemPath } = options;

  return () => {
    let cem;
    try {
      cem = JSON.parse(readFileSync(cemPath, "utf-8"));
    } catch {
      console.warn("wtfm/data/components.js: Could not read custom-elements.json at", cemPath);
      return [];
    }

    // First pass: collect all components with @docUrl
    const raw = [];
    for (const mod of cem.modules) {
      const decl = mod.declarations?.find((d) => d.docUrl);
      const url = tagValue(decl?.docUrl);
      if (!url) continue;

      raw.push({
        className: decl.name,
        tagName: decl.tagName,
        url,
        menuLabel: tagValue(decl.menuLabel),
        menuIcon: tagValue(decl.menuIcon),
        pageTitle: tagValue(decl.docPageTitle) || tagValue(decl.menuLabel) || decl.tagName,
        metaDescription: firstSentence(decl.description),
      });
    }

    // Sort alphabetically by URL for stable ordering
    raw.sort((a, b) => a.url.localeCompare(b.url));

    // Second pass: build breadcrumbs (needs the full list for parent lookups)
    for (const comp of raw) {
      comp.crumbs = buildCrumbs(comp.url, comp.pageTitle, raw);
    }

    return raw;
  };
}
