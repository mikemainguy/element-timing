import { beforeEach, describe, expect, it, vi } from "vitest";
import { record, type TimingEvent } from "../src/core.js";
import { connectDynatrace, dynatraceSink, EVENT_PROPERTIES, toDynatraceFields } from "../src/dynatrace.js";
import { resetRegistry, tagged } from "./helpers.js";

beforeEach(resetRegistry);

function stubRum() {
  const sendEvent = vi.fn();
  vi.stubGlobal("dynatrace", { sendEvent });
  return sendEvent;
}

const event: TimingEvent = {
  name: "buy",
  phase: "interactive",
  source: "hook",
  time: 1250.4,
  sinceNavigation: 250.4,
  navigation: "/cart",
};

describe("toDynatraceFields", () => {
  it("maps the event to prefixed event properties, with the delay before sending and no start_time", () => {
    expect(toDynatraceFields(event, 6250.9)).toEqual({
      "event_properties.element_timing_name": "buy",
      "event_properties.element_timing_phase": "interactive",
      "event_properties.element_timing_source": "hook",
      "event_properties.element_timing_since_navigation": 250.4,
      "event_properties.element_timing_navigation": "/cart",
      "event_properties.element_timing_send_delay": 5001,
      duration: 250,
    });
  });

  it("measures the send delay from performance.now() by default", () => {
    vi.spyOn(performance, "now").mockReturnValue(1300);
    expect(toDynatraceFields(event)[EVENT_PROPERTIES.sendDelay]).toBe(50);
  });

  it("only uses property keys Dynatrace accepts", () => {
    for (const key of Object.values(EVENT_PROPERTIES)) {
      expect(key).toMatch(/^event_properties\.[a-z0-9_.]+$/);
    }
  });
});

describe("dynatraceSink", () => {
  it("is ready only once the RUM JavaScript provides sendEvent", () => {
    const sink = dynatraceSink();
    expect(sink.isReady()).toBe(false);

    vi.stubGlobal("dynatrace", {});
    expect(sink.isReady()).toBe(false);

    stubRum();
    expect(sink.isReady()).toBe(true);
  });

  it("sends the mapped fields", () => {
    const sendEvent = stubRum();
    dynatraceSink().send(event);
    expect(sendEvent).toHaveBeenCalledWith(toDynatraceFields(event));
  });
});

describe("connectDynatrace", () => {
  it("delivers events recorded before the RUM JavaScript loaded, with connect options applied", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "performance"] });
    const el = tagged("buy");
    record(el, "present", "dom", 5);
    record(el, "interactive", "hook", 30);

    const disconnect = connectDynatrace({ filter: (e) => e.phase === "interactive" });
    const sendEvent = stubRum();
    vi.advanceTimersByTime(250);

    expect(sendEvent).toHaveBeenCalledTimes(1);
    expect(sendEvent).toHaveBeenCalledWith(expect.objectContaining({ [EVENT_PROPERTIES.phase]: "interactive" }));

    disconnect();
    vi.useRealTimers();
  });

  it("works with no options", () => {
    const sendEvent = stubRum();
    connectDynatrace();
    record(tagged("hero"), "present", "dom", 1);
    expect(sendEvent).toHaveBeenCalledWith(expect.objectContaining({ [EVENT_PROPERTIES.name]: "hero" }));
  });
});
