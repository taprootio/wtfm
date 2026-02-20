/**
 * Shared CEM (Custom Elements Manifest) declaration stubs
 * for use across all wtfm test files.
 */

/** Bare-minimum CEM declaration: just a tag name and class name. */
export const minimalDecl = {
  name: "MyComponent",
  tagName: "my-component",
};

/**
 * A fully-populated CEM declaration covering every section
 * that the renderers consume.
 */
export const fullDecl = {
  name: "TestElement",
  tagName: "test-element",
  description:
    "A test element used for unit testing.\n\nIt supports multiple features.",
  github: { name: "https://github.com/example/test-element" },
  docSections: null,
  attributes: [
    {
      name: "label",
      fieldName: "label",
      type: { text: "string" },
      default: '""',
      description: "The visible label text.",
    },
    {
      name: "disabled",
      fieldName: "disabled",
      type: { text: "boolean" },
      default: "false",
      description: "Whether the element is disabled.",
    },
    {
      name: "size",
      fieldName: "size",
      type: { text: "'small' | 'medium' | 'large'" },
      default: '"medium"',
      description: "Controls the element size.",
    },
  ],
  members: [
    {
      kind: "method",
      name: "toggleOpen",
      privacy: "public",
      description: "Toggles the open state.",
      parameters: [],
      return: { type: { text: "void" } },
    },
    {
      kind: "method",
      name: "close",
      privacy: "public",
      description: "Closes the element.",
      parameters: [
        {
          name: "animate",
          type: { text: "boolean" },
          default: "true",
          description: "Whether to animate the close action.",
        },
      ],
      return: { type: { text: "void" } },
    },
    {
      kind: "method",
      name: "_internalSetup",
      privacy: "private",
      description: "Internal lifecycle hook.",
    },
    {
      kind: "field",
      name: "isOpen",
      privacy: "public",
      description: "Tracks open state.",
      type: { text: "boolean" },
    },
  ],
  events: [
    {
      name: "opened",
      type: { text: "CustomEvent" },
      description: "Fires when the element opens.",
    },
    {
      name: "closed",
      type: { text: "CustomEvent<{ reason: string }>" },
      description: "Fires when the element closes.",
    },
  ],
  slots: [
    {
      name: "",
      description: "The default content slot.\n\nAccepts any HTML.",
    },
    {
      name: "header",
      description: "Content for the header area.",
    },
  ],
  cssParts: [
    {
      name: "container",
      description: "The outer container element.",
    },
    {
      name: "label",
      description: "The label text element.",
    },
  ],
  cssProperties: [
    {
      name: "--test-bg",
      default: "#fff",
      description: "Background color of the element.",
    },
    {
      name: "--test-fg",
      default: "#000",
      description: "Foreground (text) color.",
    },
  ],
};

/**
 * A declaration with `variant` and `scheme` attributes — used
 * to test attribute filtering with `excludeAttributes` and
 * `attributeExceptions`.
 */
export const declWithExcludedAttrs = {
  name: "EspRoot",
  tagName: "esp-root",
  description: "Root element with scheme support.",
  attributes: [
    {
      name: "variant",
      fieldName: "variant",
      type: { text: "string" },
      default: '"primary"',
      description: "Visual variant.",
    },
    {
      name: "scheme",
      fieldName: "scheme",
      type: { text: "'light' | 'dark'" },
      default: '"light"',
      description: "Color scheme.",
    },
    {
      name: "label",
      fieldName: "label",
      type: { text: "string" },
      default: '""',
      description: "Accessible label.",
    },
  ],
  members: [],
  events: [],
  slots: [],
  cssParts: [],
  cssProperties: [],
};

/**
 * A declaration with slot and attribute descriptions containing
 * inline `</script>` tags — for testing that the CEM JSON is
 * safe to embed inside `<script type="application/json">`.
 */
export const declWithScriptInDescription = {
  name: "EspalierDialog",
  tagName: "esp-dialog",
  description: "A dialog component.",
  attributes: [
    {
      name: "full-screen",
      fieldName: "fullScreen",
      type: { text: "boolean" },
      default: "false",
      description:
        'Shows full screen.\n\n```html\n<esp-dialog full-screen></esp-dialog>\n<script>\n  findByTagName("esp-dialog")[0].toggleOpen();\n</script>\n```',
    },
  ],
  members: [],
  events: [],
  slots: [
    {
      name: "",
      description:
        'Default slot. ```html <esp-dialog><p>Content</p></esp-dialog> <script>findByTagName("esp-dialog")[0].toggleOpen();</script> ```',
    },
  ],
  cssParts: [],
  cssProperties: [],
};

/**
 * A declaration with a description containing an embedded
 * ```html code block — for testing buildDocSection's HTML
 * processing pipeline.
 */
export const declWithCodeBlock = {
  name: "DemoWidget",
  tagName: "demo-widget",
  description: 'A widget.\n\n```html\n<demo-widget label="Hello"></demo-widget>\n```\n\nMore text after the code block.',
  attributes: [
    {
      name: "label",
      fieldName: "label",
      type: { text: "string" },
      default: '""',
      description: 'The label.\n\n```html\n<demo-widget label="Example"></demo-widget>\n```',
    },
  ],
  members: [],
  events: [],
  slots: [],
  cssParts: [],
  cssProperties: [],
};
