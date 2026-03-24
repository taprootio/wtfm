import { css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { EspalierElementBase } from "@taprootio/taproot-controls";
import {
  getHighlighter,
  getHighlightTheme,
  whenHighlighterReady,
} from "./wtfm-highlighter.js";

import { safeStringify } from "./safe-stringify.js";

// ── Types ──────────────────────────────────────────────────────

interface CemAttribute {
  name: string;
  type: string;
  default?: string;
  description?: string;
}

interface CemEvent {
  name: string;
  type?: string;
}

interface CemSlot {
  name: string;
  description?: string;
}

interface CemData {
  attributes: CemAttribute[];
  events: CemEvent[];
  slots: CemSlot[];
}

interface EventLogEntry {
  name: string;
  timestamp: string;
  detail: string;
}

// ── Component ──────────────────────────────────────────────────

/**
 * An interactive documentation code block that provides
 * syntax-highlighted source, an attribute playground, and
 * an event log for an Espalier component.
 *
 * The live demo is rendered **after** this element in light DOM
 * so that it flows naturally at full width without padding
 * constraints.
 *
 * The component expects up to two light-DOM children:
 *
 * 1. A `<template>` containing the HTML to demonstrate.
 * 2. An optional `<script type="application/json">` with CEM
 *    metadata (attributes, events, slots) for the target
 *    component.  When present, the Attributes and Event Log
 *    tabs are shown.
 *
 * @customElement wtfm-code-block
 */
@customElement("wtfm-code-block")
export class WtfmCodeBlock extends EspalierElementBase {
  // ── Public properties ─────────────────────────────────────

  /** The custom-element tag name being demonstrated. */
  @property({ attribute: "tag-name" })
  public componentTagName = "";

  // ── Internal state ────────────────────────────────────────

  @state() private cemData: CemData | null = null;
  @state() private sourceHtml = "";
  @state() private highlightedCode = "";
  @state() private eventLog: EventLogEntry[] = [];
  @state() private attrValues: Map<string, string | boolean> = new Map();
  @state() private copyLabel = "Copy";

  /**
   * True when the demo contains exactly one instance of the
   * documented component, meaning Attributes and Event Log
   * tabs are meaningful.  Multi-instance demos (e.g. color
   * variant grids) suppress these tabs to avoid confusion.
   */
  @state() private singleInstance = false;

  /** Reference to the primary demo element inside the demo container. */
  private demoElement: Element | null = null;

  /** The light-DOM demo container rendered after this element. */
  private demoContainer: HTMLDivElement | null = null;

  // ── Lifecycle ─────────────────────────────────────────────

  override connectedCallback(): void {
    super.connectedCallback();
    this.parseCemData();
    this.parseSourceTemplate();
  }

  protected override firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    this.buildDemo();
    this.generateCode();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    // Clean up the light-DOM demo container when removed.
    this.demoContainer?.remove();
    this.demoContainer = null;
    this.demoElement = null;
  }

  // ── Parsing ───────────────────────────────────────────────

  private parseCemData(): void {
    const script = this.querySelector(
      'script[type="application/json"]',
    );
    if (!script?.textContent) return;
    try {
      this.cemData = JSON.parse(script.textContent) as CemData;
    } catch {
      console.warn("wtfm-code-block: invalid CEM JSON");
    }
  }

  private parseSourceTemplate(): void {
    // Prefer the base64-encoded `source` attribute — the build
    // pipeline encodes HTML this way so markdown-it cannot corrupt
    // content inside <script> or <style> blocks.
    const encoded = this.getAttribute("source");
    if (encoded) {
      try {
        this.sourceHtml = atob(encoded);
        return;
      } catch {
        console.warn("wtfm-code-block: failed to decode source attribute");
      }
    }

    // Fallback: read from a <template> child (used by the runtime
    // path where initWtfmRuntime converts HTML code fences).
    const tpl = this.querySelector("template") as HTMLTemplateElement | null;
    if (!tpl) return;
    const wrapper = document.createElement("div");
    wrapper.appendChild(tpl.content.cloneNode(true));
    this.sourceHtml = wrapper.innerHTML.trim();
  }

  // ── Demo building ─────────────────────────────────────────

  private buildDemo(): void {
    if (!this.sourceHtml) return;

    // Create the demo container in light DOM, after this element.
    const container = document.createElement("div");
    container.className = "demo-wrapper wtfm-demo-container";
    container.style.cssText =
      "display: grid; gap: var(--esp-size-padding, 1rem); padding: var(--esp-size-padding, 1rem) 0;";
    this.after(container);
    this.demoContainer = container;

    container.innerHTML = this.sourceHtml;

    // Collect <script> sources and remove the originals (they
    // don't execute when set via innerHTML).
    const scriptSources: string[] = [];
    for (const script of [...container.querySelectorAll("script")]) {
      scriptSources.push(script.textContent?.trim() ?? "");
      script.remove();
    }

    // Store a reference to the main demo element and check
    // whether this is a single-instance demo.
    if (this.componentTagName) {
      const instances = container.querySelectorAll(this.componentTagName);
      this.singleInstance = instances.length === 1;
      this.demoElement = instances[0] ?? null;
    }

    // Initialise attrValues from the live DOM.
    if (this.demoElement && this.singleInstance && this.cemData) {
      const fresh = new Map<string, string | boolean>();
      for (const attr of this.cemData.attributes) {
        if (this.classifyAttrType(attr) === "boolean") {
          fresh.set(attr.name, this.demoElement.hasAttribute(attr.name));
        } else {
          fresh.set(
            attr.name,
            this.demoElement.getAttribute(attr.name) ?? "",
          );
        }
      }
      this.attrValues = fresh;
    }

    this.attachEventListeners();

    // Execute demo scripts synchronously so they can capture
    // element references before Lit's firstUpdated fires on
    // child components (which may reparent elements — e.g.
    // esp-dialog moves itself into the page-level dialog zone).
    this.runDemoScripts(scriptSources);
  }

  // ── Event listeners ───────────────────────────────────────

  private attachEventListeners(): void {
    if (!this.singleInstance || !this.demoElement || !this.cemData?.events)
      return;

    for (const ev of this.cemData.events) {
      this.demoElement.addEventListener(ev.name, (e: Event) => {
        const ce = e as CustomEvent;
        this.eventLog = [
          {
            name: ev.name,
            timestamp: new Date().toLocaleTimeString(),
            detail: ce.detail
              ? safeStringify(ce.detail)
              : "—",
          },
          ...this.eventLog,
        ];
      });
    }
  }

  // ── Demo script execution ────────────────────────────────

  /**
   * Execute demo scripts **synchronously** inside the demo
   * container.  This must run in the same microtask as
   * `buildDemo` so that element references are captured before
   * child custom-elements' `firstUpdated` callbacks fire (e.g.
   * `esp-dialog` reparents itself into the page-level dialog
   * zone on first update).
   *
   * Each script gets locally-scoped `findByTagName` and
   * `findById` helpers bound to the demo container, avoiding
   * any reliance on `document.currentScript` (which is `null`
   * for dynamically-created inline scripts).
   */
  private runDemoScripts(scripts: string[]): void {
    if (scripts.length === 0 || !this.demoContainer) return;

    // Assign a unique ID so the injected script can locate its
    // container without relying on `document.currentScript`.
    const containerId =
      this.demoContainer.id || `wtfm-demo-${crypto.randomUUID()}`;
    this.demoContainer.id = containerId;

    for (const src of scripts) {
      const fresh = document.createElement("script");
      fresh.textContent = `(function() {
  var _container = document.getElementById(${JSON.stringify(containerId)});
  function findByTagName(t) { return _container.getElementsByTagName(t); }
  function findById(id) { return _container.querySelector("#" + id); }
${src}
})();`;
      this.demoContainer.appendChild(fresh);
    }
  }

  // ── Code generation ───────────────────────────────────────

  private async generateCode(): Promise<void> {
    await whenHighlighterReady();
    const highlighter = getHighlighter();
    const theme = getHighlightTheme();
    if (!highlighter) return;

    const code = this.buildCurrentHtml();
    this.highlightedCode = highlighter.codeToHtml(code.trimEnd(), {
      lang: "html",
      theme,
    });
  }

  /**
   * Return the HTML that should appear in the Code tab.
   *
   * This always returns the **original authored source** from
   * the `<template>` rather than serialising the live DOM.
   * Components modify their DOM at runtime (injecting wrapper
   * elements, applying variant styles, adding internal
   * attributes) and none of that belongs in user-facing code.
   */
  private buildCurrentHtml(): string {
    return this.sourceHtml;
  }

  // ── Clipboard ─────────────────────────────────────────────

  private async handleCopy(): Promise<void> {
    const code = this.buildCurrentHtml();
    await navigator.clipboard.writeText(code);
    this.copyLabel = "Copied!";
    setTimeout(() => {
      this.copyLabel = "Copy";
    }, 2000);
  }

  // ── Attribute playground ──────────────────────────────────

  private classifyAttrType(
    attr: CemAttribute,
  ): "boolean" | "enum" | "string" {
    const t = (attr.type ?? "").trim();
    if (t === "boolean") return "boolean";
    // String-literal union:  "foo" | "bar"  or  'foo' | 'bar'
    if (t.includes("|") && (t.includes('"') || t.includes("'")))
      return "enum";
    return "string";
  }

  private parseEnumOptions(typeStr: string): string[] {
    return typeStr
      .split("|")
      .map((s) =>
        s
          .trim()
          .replace(/^["']|["']$/g, ""),
      )
      .filter(Boolean);
  }

  private handleAttrChange(name: string, value: string | boolean): void {
    const updated = new Map(this.attrValues);
    updated.set(name, value);
    this.attrValues = updated;

    if (!this.demoElement) return;

    if (typeof value === "boolean") {
      if (value) {
        this.demoElement.setAttribute(name, "");
      } else {
        this.demoElement.removeAttribute(name);
      }
    } else {
      if (value === "") {
        this.demoElement.removeAttribute(name);
      } else {
        this.demoElement.setAttribute(name, value);
      }
    }
  }

  // ── Render helpers ────────────────────────────────────────

  private renderAttrControl(attr: CemAttribute) {
    const kind = this.classifyAttrType(attr);
    const value = this.attrValues.get(attr.name);

    switch (kind) {
      case "boolean":
        return html`
          <div class="attr-control">
            <esp-checkbox
              ?checked=${!!value}
              @value-changed=${(e: CustomEvent) =>
                this.handleAttrChange(attr.name, e.detail.checked)}
            >
              ${attr.name}
            </esp-checkbox>
          </div>
        `;

      case "enum": {
        const options = this.parseEnumOptions(attr.type);
        return html`
          <esp-form-item label=${attr.name}>
            <esp-pick-one
              @value-changed=${(e: CustomEvent) => {
                const picked = e.detail;
                this.handleAttrChange(
                  attr.name,
                  picked?.value ?? "",
                );
              }}
            >
              ${options.map(
                (opt) => html`
                  <esp-picker-item
                    text=${opt}
                    value=${opt}
                    ?selected=${value === opt}
                  ></esp-picker-item>
                `,
              )}
            </esp-pick-one>
          </esp-form-item>
        `;
      }

      case "string":
      default:
        return html`
          <esp-form-item label=${attr.name}>
            <esp-input
              .value=${String(value ?? "")}
              @value-changed=${(e: CustomEvent) =>
                this.handleAttrChange(attr.name, e.detail)}
            ></esp-input>
          </esp-form-item>
        `;
    }
  }

  // ── Render ────────────────────────────────────────────────

  protected override render() {
    const attrs = this.cemData?.attributes ?? [];
    const showPlayground = this.singleInstance && attrs.length > 0;
    const showEventLog =
      this.singleInstance && (this.cemData?.events?.length ?? 0) > 0;

    return html`
      <esp-tab-group>
        <esp-tab label="Code" active>
          <div class="code-container">
            <button class="copy-btn" @click=${this.handleCopy}>
              ${this.copyLabel}
            </button>
            ${unsafeHTML(this.highlightedCode)}
          </div>
        </esp-tab>
        ${showPlayground
          ? html`
              <esp-tab label="Attributes">
                <div class="playground">
                  ${attrs.map((a) => this.renderAttrControl(a))}
                </div>
              </esp-tab>
            `
          : nothing}
        ${showEventLog
          ? html`
              <esp-tab label="Event Log">
                <div class="event-log">
                  <button
                    class="clear-btn"
                    @click=${() => {
                      this.eventLog = [];
                    }}
                  >
                    Clear
                  </button>
                  ${this.eventLog.length === 0
                    ? html`<p class="empty">
                        No events yet. Interact with the demo below.
                      </p>`
                    : html`
                        <ul>
                          ${this.eventLog.map(
                            (entry) => html`
                              <li>
                                <span class="event-name">${entry.name}</span>
                                <span class="event-time"
                                  >${entry.timestamp}</span
                                >
                                <code class="event-detail"
                                  >${entry.detail}</code
                                >
                              </li>
                            `,
                          )}
                        </ul>
                      `}
                </div>
              </esp-tab>
            `
          : nothing}
      </esp-tab-group>
    `;
  }

  // ── Styles ────────────────────────────────────────────────

  static override styles = [
    ...EspalierElementBase.styles,
    css`
      :host {
        display: block;
        margin: var(--esp-size-padding, 1rem) 0 0;
      }

      esp-tab {
        max-height: 60vh;
        overflow-y: auto;
      }

      .code-container {
        position: relative;

        pre {
          margin: 0;
          border-radius: var(--esp-size-border-radius, 4px);
          overflow-x: auto;
          /* Override Shiki's inline background/color so the design
             system tokens control all colors. */
          background-color: var(--esp-color-bg-2, #f5f5f5) !important;
          color: var(--esp-color-text, #333) !important;
        }
      }

      .copy-btn,
      .clear-btn {
        font-family: var(--esp-font-body, sans-serif);
        font-size: calc(0.85 * var(--esp-size-font, 1rem));
        padding: var(--esp-size-tiny, 4px) var(--esp-size-small, 8px);
        background: var(--esp-color-layer-2, #f5f5f5);
        color: var(--esp-color-text, #333);
        border: 1px solid var(--esp-color-border, #ccc);
        border-radius: var(--esp-size-border-radius, 4px);
        cursor: pointer;
      }

      .copy-btn {
        position: absolute;
        top: var(--esp-size-tiny, 4px);
        right: var(--esp-size-tiny, 4px);
        z-index: 1;
      }

      .copy-btn:hover,
      .clear-btn:hover {
        background: oklch(
          from var(--esp-color-layer-2) calc(l * 0.92) c h
        );
      }

      :host([scheme="light"]) .copy-btn:hover,
      :host([scheme="light"]) .clear-btn:hover {
        background: oklch(
          from var(--esp-color-layer-2) calc(l + (1 - l) * 0.4) c h
        );
      }

      .playground {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: var(--esp-size-padding, 1rem);
        align-items: end;
        padding: var(--esp-size-small, 0.5rem) 0;
      }

      .attr-control {
        display: grid;
        gap: var(--esp-size-tiny, 4px);
      }

      .event-log {
        font-family: var(--esp-font-monospace, monospace);
        font-size: calc(0.85 * var(--esp-size-font, 1rem));
        padding: var(--esp-size-small, 0.5rem) 0;

        ul {
          list-style: none;
          padding: 0;
          margin: 0;
          max-height: 300px;
          overflow-y: auto;
        }

        li {
          display: grid;
          grid-template-columns: auto auto 1fr;
          gap: var(--esp-size-small, 0.5rem);
          padding: var(--esp-size-tiny, 4px) 0;
          border-bottom: 1px solid var(--esp-color-border, #eee);
          align-items: baseline;
        }

        .event-name {
          font-weight: 600;
          color: var(--esp-color-headings, #333);
        }

        .event-time {
          color: var(--esp-color-success, #666);
          font-size: calc(0.8 * var(--esp-size-font, 1rem));
        }

        .event-detail {
          white-space: pre-wrap;
          word-break: break-all;
          color: var(--esp-color-text, #333);
        }

        .empty {
          color: var(--esp-color-text, #666);
          font-style: italic;
          margin: 0;
        }
      }

      .clear-btn {
        margin-bottom: var(--esp-size-small, 0.5rem);
      }
    `,
  ];
}

declare global {
  interface HTMLElementTagNameMap {
    "wtfm-code-block": WtfmCodeBlock;
  }
}
