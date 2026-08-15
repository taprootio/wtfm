export const navigation = [
  {
    label: "Start",
    items: [
      { label: "WTFM overview", url: "/", resourceKey: "concept:overview" },
      {
        label: "Installation and setup",
        url: "/getting-started/",
        resourceKey: "guide:getting-started",
      },
      {
        label: "Plugin configuration",
        url: "/plugin/",
        resourceKey: "reference:plugin-configuration",
      },
    ],
  },
  {
    label: "Authoring",
    items: [
      {
        label: "Documents and surfaces",
        url: "/authoring/",
        resourceKey: "concept:documents-and-surfaces",
      },
      {
        label: "Renderers and semantics",
        url: "/renderers/",
        resourceKey: "reference:renderers",
      },
      {
        label: "Help and anchors",
        url: "/help/",
        resourceKey: "guide:help-and-anchors",
      },
    ],
  },
  {
    label: "Output",
    items: [
      {
        label: "Taproot Docs artifact",
        url: "/artifact-mode/",
        resourceKey: "guide:taproot-docs-artifact",
      },
      {
        label: "Validation and troubleshooting",
        url: "/troubleshooting/",
        resourceKey: "guide:validation-and-troubleshooting",
      },
    ],
  },
  {
    label: "Runtime",
    items: [
      {
        label: "Client runtime and code blocks",
        url: "/client-runtime/",
        resourceKey: "concept:client-runtime",
      },
    ],
  },
];

export const taprootNavigation = navigation.map((group) => ({
  label: group.label,
  children: group.items.map(({ label, resourceKey }) => ({
    label,
    resourceKey,
  })),
}));
