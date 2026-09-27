// Zero-touch "handler is live" detection.
//
// React 19 doesn't add listeners per element; it delegates from the root and reads handlers
// from props that hydration stores on each DOM node under a private, randomised key
// (`__reactProps$<random>`). Once that key holds an `on*` function, a click will reach the
// handler. This is React-internal and may change in any release — the `timingProps` ref in
// ./timed.ts is the supported alternative.

import { record } from "./core.js";

const PROPS_PREFIX = "__reactProps$";
const TIMEOUT_MS = 30_000;
const POLL_MS = 16;

const pending = new Map<Element, number>();
let timer: ReturnType<typeof setTimeout> | undefined;

function hasReactHandler(el: Element) {
  for (const key of Object.keys(el)) {
    if (!key.startsWith(PROPS_PREFIX)) continue;
    const props = (el as unknown as Record<string, Record<string, unknown>>)[key];
    return Object.keys(props).some((k) => /^on[A-Z]/.test(k) && typeof props[k] === "function");
  }
  return false;
}

// One shared poll for every pending element (~16ms resolution). setTimeout rather than
// requestAnimationFrame: rAF is paused in background tabs, but hydration still runs there.
function tick() {
  const now = performance.now();
  for (const [el, since] of pending) {
    if (hasReactHandler(el)) {
      record(el, "interactive", "react-internals", now);
      pending.delete(el);
    } else if (!el.isConnected || now - since > TIMEOUT_MS) {
      pending.delete(el);
    }
  }
  timer = pending.size > 0 ? setTimeout(tick, POLL_MS) : undefined;
}

export function watchReactHandlers(el: Element) {
  if (pending.has(el)) return;
  pending.set(el, performance.now());
  timer ??= setTimeout(tick, POLL_MS);
}
