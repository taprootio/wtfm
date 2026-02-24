/**
 * Shared type manifest declaration stubs for use across
 * all wtfm type-related test files.
 */

/** A minimal interface declaration with two members. */
export const interfaceDecl = {
  kind: "interface",
  name: "SchemeEvents",
  description:
    "Theme coordination events.\n\nPublished by `<esp-root>` and subscribed to by every `EspalierElementBase` descendant.",
  members: [
    {
      kind: "field",
      name: "seed-color-changed",
      type: { text: "{ seedColor: string; correlationId: string }" },
      description: "Fired when the effective seed color changes.",
      privacy: "public",
    },
    {
      kind: "field",
      name: "scheme-changed",
      type: { text: '{ scheme: "light" | "dark"; correlationId: string }' },
      description: "Fired when the active scheme flips between light and dark.",
      privacy: "public",
    },
  ],
  docUrl: { name: "/api/scheme-events" },
  menuLabel: { name: "Scheme", description: "Events" },
  docPageTitle: { name: "SchemeEvents" },
};

/** An interface with an optional member. */
export const interfaceWithOptionalDecl = {
  kind: "interface",
  name: "PopoverEvents",
  description: "Cross-popover coordination events.",
  members: [
    {
      kind: "field",
      name: "close-popovers",
      type: { text: "{ source?: object; skipPopovers?: HTMLElement[] }" },
      description: "Fires when open popovers should be closed.",
      privacy: "public",
      optional: false,
    },
  ],
  docUrl: { name: "/api/popover-events" },
};

/** A type alias declaration. */
export const typeAliasDecl = {
  kind: "type-alias",
  name: "EspBusEventMap",
  description: "Every event published on the singleton EspBus.",
  type: {
    text: "SchemeEvents & ToastEvents & PopoverEvents & SizeEvents & PageEventMap",
  },
  docUrl: { name: "/api/esp-bus-event-map" },
  menuLabel: { name: "EspBusEventMap" },
};

/** A const object declaration with members. */
export const variableDecl = {
  kind: "variable",
  name: "ESP_EVENTS",
  description: "Canonical event name strings for every CustomEvent in the library.",
  type: {
    text: '{ readonly VALUE_CHANGED: "value-changed"; readonly CLICKED: "clicked" }',
  },
  members: [
    {
      kind: "field",
      name: "VALUE_CHANGED",
      type: { text: '"value-changed"' },
      description: "",
      privacy: "public",
    },
    {
      kind: "field",
      name: "CLICKED",
      type: { text: '"clicked"' },
      description: "",
      privacy: "public",
    },
  ],
  docUrl: { name: "/api/esp-events" },
  menuLabel: { name: "ESP_EVENTS" },
};

/** A function declaration with type parameters. */
export const functionDecl = {
  kind: "function",
  name: "getEspBus",
  description: "Typed accessor for the singleton bus.",
  typeParameters: [
    {
      name: "T",
      constraint: "EspBusEventMap",
      default: "EspBusEventMap",
    },
  ],
  parameters: [],
  return: {
    type: { text: "EspBus<T>" },
    description: "Pre-typed bus instance.",
  },
  docUrl: { name: "/api/get-esp-bus" },
};

/** A function with actual parameters. */
export const functionWithParamsDecl = {
  kind: "function",
  name: "showToast",
  description: "Shows a toast notification.",
  parameters: [
    {
      name: "config",
      type: { text: "ToastConfig" },
      description: "Configuration object for the toast.",
    },
    {
      name: "duration",
      type: { text: "number" },
      description: "Duration in milliseconds.",
      optional: true,
      default: "3000",
    },
  ],
  return: {
    type: { text: "void" },
  },
  docUrl: { name: "/api/show-toast" },
};

/** A type manifest with multiple modules and declarations. */
export const sampleTypeManifest = {
  modules: [
    {
      path: "src/shared/bus-events.ts",
      declarations: [interfaceDecl, typeAliasDecl, functionDecl],
    },
    {
      path: "src/shared/events.ts",
      declarations: [variableDecl],
    },
  ],
};
