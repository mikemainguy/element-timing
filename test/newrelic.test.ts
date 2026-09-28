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

  it("records the event's fields as a custom event, with the name as elementName and the send delay", () => {
    const recordCustomEvent = stubAgent();
    vi.spyOn(performance, "now").mockReturnValue(5120.6);

    newRelicSink("Custom").send({
      name: "buy",
      phase: "interactive",
      source: "hook",
      time: 120,
      sinceNavigation: 20,
      navigation: "/cart",
    });

    // Not `name`: the agent overwrites that with its own transaction name.
    expect(recordCustomEvent).toHaveBeenCalledWith("Custom", {
      elementName: "buy",
      phase: "interactive",
      source: "hook",
      time: 120,
      sinceNavigation: 20,
      navigation: "/cart",
      // The agent stamps `timestamp` at send time; timestamp - sendDelay is when it happened.
      sendDelay: 5001,
    });
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
    expect(recordCustomEvent).toHaveBeenCalledWith("Timing", expect.objectContaining({ elementName: "buy", time: 30 }));

    disconnect();
    vi.useRealTimers();
  });

  it("works with no options", () => {
    const recordCustomEvent = stubAgent();
    connectNewRelic();
    record(tagged("hero"), "present", "dom", 1);
    expect(recordCustomEvent).toHaveBeenCalledWith("ElementTiming", expect.objectContaining({ elementName: "hero" }));
  });
});
