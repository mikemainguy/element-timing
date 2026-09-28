import { TIMING_ATTR } from "../src/core.js";

/** Drop the shared registry so each test starts with no events, listeners or navigation. */
export function resetRegistry() {
  delete (globalThis as { __elementTiming?: unknown }).__elementTiming;
  performance.clearMarks();
  performance.clearMeasures();
  document.body.innerHTML = "";
}

export function tagged(name: string, tag = "div") {
  const el = document.createElement(tag);
  el.setAttribute(TIMING_ATTR, name);
  return el;
}

/** Simulate React hydration storing props under its private `__reactProps$<random>` key. */
export function setReactProps(el: Element, props: Record<string, unknown>) {
  (el as unknown as Record<string, unknown>)["__reactProps$abc123"] = props;
}
