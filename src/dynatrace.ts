// Dynatrace RUM sink (new RUM experience). Sends each timing event with `dynatrace.sendEvent`.
//
//   import { connectDynatrace } from "next-element-timing/dynatrace";
//   connectDynatrace();
//
// Dynatrace discards event properties that haven't been defined in its web UI, so define
// every key in EVENT_PROPERTIES there first (see the README). The RUM JavaScript is read from
// `window.dynatrace` at runtime, so this package has no dependency on it. Until it loads,
// events wait in connect(); see ./sinks.ts.

import type { TimingEvent } from "./core.js";
import { connect, type ConnectOptions, type TimingSink } from "./sinks.js";

/** The subset of the Dynatrace RUM JavaScript API this sink uses. */
type DynatraceApi = {
  sendEvent(fields: Record<string, string | number>): void;
};

/** The event properties this sink sends, each of which must be defined in Dynatrace. */
export const EVENT_PROPERTIES = {
  name: "event_properties.element_timing_name",
  phase: "event_properties.element_timing_phase",
  source: "event_properties.element_timing_source",
  sinceNavigation: "event_properties.element_timing_since_navigation",
  navigation: "event_properties.element_timing_navigation",
  sendDelay: "event_properties.element_timing_send_delay",
} as const;

function rum() {
  return (window as Window & { dynatrace?: Partial<DynatraceApi> }).dynatrace;
}

/**
 * Maps an event to sendEvent fields, `now` being when it's sent (performance.now()).
 *
 * Dynatrace ignores a `start_time` sent this way: it stores `end_time` as when the event was sent
 * and `start_time` as `end_time - duration`. So `duration` is `sinceNavigation`, and
 * `element_timing_send_delay` (ms) is how long the event waited to be sent, which makes
 * `end_time - send_delay` when it happened, in Dynatrace's time-corrected clock.
 */
export function toDynatraceFields(event: TimingEvent, now = performance.now()): Record<string, string | number> {
  return {
    [EVENT_PROPERTIES.name]: event.name,
    [EVENT_PROPERTIES.phase]: event.phase,
    [EVENT_PROPERTIES.source]: event.source,
    [EVENT_PROPERTIES.sinceNavigation]: event.sinceNavigation,
    [EVENT_PROPERTIES.navigation]: event.navigation,
    [EVENT_PROPERTIES.sendDelay]: Math.round(now - event.time),
    duration: Math.round(event.sinceNavigation),
  };
}

/** A sink that sends each timing event to Dynatrace RUM as a custom event. */
export function dynatraceSink(): TimingSink {
  return {
    name: "dynatrace",
    isReady: () => typeof rum()?.sendEvent === "function",
    send: (event) => (rum() as DynatraceApi).sendEvent(toDynatraceFields(event)),
  };
}

/** Send timing events to Dynatrace. Returns a function that stops sending. */
export function connectDynatrace(options: ConnectOptions = {}) {
  return connect(dynatraceSink(), options);
}
