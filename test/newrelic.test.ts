import { beforeEach, describe, expect, it, vi } from "vitest";
import { record } from "../src/core.js";
import { connectNewRelic, DEFAULT_EVENT_TYPE, newRelicSink } from "../src/newrelic.js";
import { resetRegistry, tagged } from "./helpers.js";

beforeEach(resetRegistry);

function stubAgent() {
  const recordCustomEvent = vi.fn();
  vi.stubGlobal("newrelic", { recordCustomEvent });
  return recordCustomEvent;
}

describe("newRelicSink", () => {
  it("is ready only once the agent provides recordCustomEvent", () => {
    const sink = newRelicSink();
    expect(sink.isReady()).toBe(false);

    vi.stubGlobal("newrelic", { addPageAction: () => {} });
    expect(sink.isReady()).toBe(false);

    stubAgent();
    expect(sink.isReady()).toBe(true);
  });

  it("records the event's fields as a custom event", () => {
    const recordCustomEvent = stubAgent();
    const event = {
      name: "buy",
      phase: "interactive",
      source: "hook",
      time: 120,
      sinceNavigation: 20,
      navigation: "/cart",
    } as const;

    newRelicSink("Custom").send(event);

    expect(recordCustomEvent).toHaveBeenCalledWith("Custom", { ...event });
    expect(recordCustomEvent.mock.calls[0][1]).not.toBe(event);
  });

  it("uses the ElementTiming event type by default", () => {
    const recordCustomEvent = stubAgent();
    newRelicSink().send({ name: "a", phase: "present", source: "dom", time: 1, sinceNavigation: 1, navigation: "/" });
    expect(recordCustomEvent).toHaveBeenCalledWith(DEFAULT_EVENT_TYPE, expect.any(Object));
    expect(DEFAULT_EVENT_TYPE).toBe("ElementTiming");
  });
});

describe("connectNewRelic", () => {
  it("delivers events recorded before the agent loaded, with connect options applied", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "performance"] });
    const el = tagged("buy");
    record(el, "present", "dom", 5);
    record(el, "interactive", "hook", 30);

    const disconnect = connectNewRelic({ eventType: "Timing", filter: (e) => e.phase === "interactive" });
    const recordCustomEvent = stubAgent();
    vi.advanceTimersByTime(250);

    expect(recordCustomEvent).toHaveBeenCalledTimes(1);
    expect(recordCustomEvent).toHaveBeenCalledWith("Timing", expect.objectContaining({ name: "buy", time: 30 }));

    disconnect();
    vi.useRealTimers();
  });

  it("works with no options", () => {
    const recordCustomEvent = stubAgent();
    connectNewRelic();
    record(tagged("hero"), "present", "dom", 1);
    expect(recordCustomEvent).toHaveBeenCalledWith("ElementTiming", expect.objectContaining({ name: "hero" }));
  });
});
