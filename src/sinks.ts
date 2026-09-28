// Vendor-neutral delivery of timing events to monitoring tools (New Relic, Dynatrace, …).
//
// A sink only knows how to hand one event to its vendor. connect() does the rest, the same way
// for every vendor:
//   - replays events recorded before it was called, since the client module records from
//     before hydration, usually before any monitoring script has loaded
//   - holds events until the sink is ready, polling for the vendor script, then flushes them
//   - delivers each event to a sink at most once
//   - isolates failures, so a broken sink can't break the page or other sinks
//
// Events cleared with clearEvents() before a sink was ready are not delivered to it.

import { getEvents, subscribe, type TimingEvent } from "./core.js";

export type TimingSink = {
  /** Used in warnings. */
  name: string;
  /** False until the vendor's script has loaded; events wait until this is true. */
  isReady(): boolean;
  send(event: TimingEvent): void;
};

export type ConnectOptions = {
  /** Only deliver events this returns true for. */
  filter?: (event: TimingEvent) => boolean;
  /**
   * Fraction of page loads (0–1) that report at all, decided once per connect() so a
   * sampled page reports every event. Defaults to 1.
   */
  sampleRate?: number;
  /** How often to check isReady() while events are waiting. Defaults to 250 ms. */
  retryMs?: number;
  /**
   * Stop polling isReady() after this long. Waiting events are still delivered if the sink
   * becomes ready and a later event is recorded. Defaults to 30 s.
   */
  timeoutMs?: number;
};

const DEFAULT_RETRY_MS = 250;
const DEFAULT_TIMEOUT_MS = 30_000;

/** Deliver timing events to `sink`. Returns a function that disconnects it. */
export function connect(sink: TimingSink, options: ConnectOptions = {}): () => void {
  const {
    filter = () => true,
    sampleRate = 1,
    retryMs = DEFAULT_RETRY_MS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;
  if (typeof window === "undefined" || !(Math.random() < sampleRate)) return () => {};

  const delivered = new WeakSet<TimingEvent>();
  const giveUpAt = performance.now() + timeoutMs;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let warned = false;

  function warn(error: unknown) {
    if (warned) return;
    warned = true;
    console.warn(`[element-timing] sink "${sink.name}" failed`, error);
  }

  function isReady() {
    try {
      return sink.isReady();
    } catch (error) {
      warn(error);
      return false;
    }
  }

  function flush() {
    const pending = getEvents().filter((event) => !delivered.has(event));
    if (pending.length === 0) return;

    if (!isReady()) {
      if (retry === undefined && performance.now() < giveUpAt) {
        retry = setTimeout(() => {
          retry = undefined;
          flush();
        }, retryMs);
      }
      return;
    }

    for (const event of pending) {
      // Marked before sending so an event the sink throws on isn't retried forever.
      delivered.add(event);
      try {
        if (filter(event)) sink.send(event);
      } catch (error) {
        warn(error);
      }
    }
  }

  const unsubscribe = subscribe(flush);
  flush();

  return () => {
    unsubscribe();
    clearTimeout(retry);
    retry = undefined;
  };
}
