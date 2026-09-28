// New Relic browser agent sink. Sends each timing event as a custom event with
// `newrelic.recordCustomEvent`, which needs the Pro or Pro+SPA agent, v1.277.0 or later.
//
//   import { connectNewRelic } from "next-element-timing/newrelic";
//   connectNewRelic();
//
// The agent is read from `window.newrelic` at runtime, so this package has no dependency on it.
// Until the agent (or its loader snippet's queue) provides recordCustomEvent, events wait in
// connect(); see ./sinks.ts.

import { connect, type ConnectOptions, type TimingSink } from "./sinks.js";

/** The subset of the New Relic browser API this sink uses. */
type NewRelicBrowserApi = {
  recordCustomEvent(eventType: string, attributes: Record<string, string | number>): void;
};

export const DEFAULT_EVENT_TYPE = "ElementTiming";

function agent() {
  return (window as Window & { newrelic?: Partial<NewRelicBrowserApi> }).newrelic;
}

/** A sink that records each timing event as a New Relic custom event of `eventType`. */
export function newRelicSink(eventType = DEFAULT_EVENT_TYPE): TimingSink {
  return {
    name: "newrelic",
    isReady: () => typeof agent()?.recordCustomEvent === "function",
    send: ({ name, phase, source, time, sinceNavigation, navigation }) =>
      (agent() as NewRelicBrowserApi).recordCustomEvent(eventType, {
        name,
        phase,
        source,
        time,
        sinceNavigation,
        navigation,
      }),
  };
}

export type NewRelicOptions = ConnectOptions & {
  /** The custom event type to query in NRQL. Defaults to "ElementTiming". */
  eventType?: string;
};

/** Send timing events to New Relic. Returns a function that stops sending. */
export function connectNewRelic({ eventType, ...options }: NewRelicOptions = {}) {
  return connect(newRelicSink(eventType), options);
}
