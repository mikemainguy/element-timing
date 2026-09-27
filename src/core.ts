// Shared registry for element timing events.
//
// Any element tagged with `data-timing="<name>"` is tracked through three phases:
//   present     — the element exists in the DOM (instrumentation-client's MutationObserver)
//   paint       — the browser painted it (Element Timing API, Chromium only; needs `elementtiming`)
//   interactive — its React event handlers are live, reported by two independent sources:
//                 "hook"            a callback ref (supported React API, opt-in per element)
//                 "react-internals" polling React's private props key (zero-touch, may break on upgrade)
//
// State lives on globalThis so instrumentation-client and client components share it
// even if the bundler gives them separate module instances.

export const TIMING_ATTR = "data-timing";

export type TimingPhase = "present" | "paint" | "interactive";
export type TimingSource = "dom" | "element-timing" | "hook" | "react-internals";

export type TimingEvent = {
  name: string;
  phase: TimingPhase;
  source: TimingSource;
  /** ms since performance.timeOrigin */
  time: number;
  /** ms since the navigation (initial load or client transition) that rendered the element */
  sinceNavigation: number;
  /** URL of that navigation */
  navigation: string;
};

/** Notified after the event list changes; read it with getEvents(). */
type Listener = () => void;

type Registry = {
  events: readonly TimingEvent[];
  listeners: Set<Listener>;
  seen: WeakMap<Element, Map<string, number>>;
  navigationStart: number;
  navigation: string;
};

const GLOBAL_KEY = "__elementTiming";

function registry(): Registry {
  const g = globalThis as typeof globalThis & { [GLOBAL_KEY]?: Registry };
  return (g[GLOBAL_KEY] ??= {
    events: [],
    listeners: new Set(),
    seen: new WeakMap(),
    navigationStart: 0,
    navigation: typeof location === "undefined" ? "" : location.pathname + location.search,
  });
}

/** Record a phase for a tagged element. Each (element, phase, source) is recorded once. */
export function record(el: Element, phase: TimingPhase, source: TimingSource, time = performance.now()) {
  const name = el.getAttribute(TIMING_ATTR);
  if (!name) return;

  const r = registry();
  const seen = r.seen.get(el) ?? new Map<string, number>();
  const key = `${phase}:${source}`;
  if (seen.has(key)) return;
  seen.set(key, time);
  r.seen.set(el, seen);

  const event: TimingEvent = {
    name,
    phase,
    source,
    time,
    sinceNavigation: time - r.navigationStart,
    navigation: r.navigation,
  };
  r.events = [...r.events, event];

  try {
    const label = `element-timing:${name}`;
    performance.mark(`${label}:${phase}:${source}`, { startTime: time, detail: event });
    const presentAt = seen.get("present:dom");
    if (phase === "interactive" && presentAt !== undefined) {
      performance.measure(`${label}:present-to-interactive:${source}`, { start: presentAt, end: time });
    }
  } catch {
    // User Timing is best-effort; never let it break the page.
  }

  window.dispatchEvent(new CustomEvent("element-timing", { detail: event }));
  for (const listener of r.listeners) listener();
}

/** Called on client-side transitions so later events are timed from the navigation, not the page load. */
export function startNavigation(url: string, time = performance.now()) {
  const r = registry();
  r.navigationStart = time;
  r.navigation = url;
}

export function subscribe(listener: Listener) {
  const { listeners } = registry();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getEvents() {
  return registry().events;
}

export function clearEvents() {
  const r = registry();
  r.events = [];
  for (const listener of r.listeners) listener();
}
