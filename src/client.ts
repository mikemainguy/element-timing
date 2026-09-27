// Client instrumentation module: runs after the HTML loads and before React hydrates.
// Watches every `[data-timing]` element for the "present", "paint" and zero-touch
// "interactive" phases; see ./core.ts.
//
// Load it with `withElementTiming` from "next-element-timing/next", or re-export it from
// your own instrumentation-client.ts: `export * from "next-element-timing/client"`.

import { record, startNavigation, TIMING_ATTR } from "./core.js";
import { watchReactHandlers } from "./react-internals.js";

declare global {
  // Not yet in TypeScript's DOM lib (Chromium-only API).
  interface PerformanceElementTiming extends PerformanceEntry {
    readonly element: Element | null;
    readonly identifier: string;
    readonly renderTime: DOMHighResTimeStamp;
    readonly loadTime: DOMHighResTimeStamp;
  }
}

const SELECTOR = `[${TIMING_ATTR}]`;

function track(el: Element) {
  // For server-rendered elements already in the document, "present" is when this script ran —
  // an upper bound; the paint phase shows when the user could actually see it.
  record(el, "present", "dom");
  watchReactHandlers(el);
}

function scan(root: Element | Document) {
  if (root instanceof Element && root.matches(SELECTOR)) track(root);
  root.querySelectorAll(SELECTOR).forEach(track);
}

try {
  scan(document);

  new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node instanceof Element) scan(node);
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });

  if (PerformanceObserver.supportedEntryTypes.includes("element")) {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as PerformanceElementTiming[]) {
        // renderTime is 0 for cross-origin images without Timing-Allow-Origin; fall back to loadTime.
        if (entry.element) record(entry.element, "paint", "element-timing", entry.renderTime || entry.loadTime);
      }
    }).observe({ type: "element", buffered: true });
  }
} catch (error) {
  console.warn("[element-timing] instrumentation failed to start", error);
}

export function onRouterTransitionStart(url: string) {
  startNavigation(url);
}
