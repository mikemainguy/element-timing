import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearEvents, getEvents, record, startNavigation, subscribe, type TimingEvent } from "../src/core.js";
import { resetRegistry, tagged } from "./helpers.js";

beforeEach(resetRegistry);

describe("record", () => {
  it("ignores elements without a data-timing name", () => {
    record(document.createElement("div"), "present", "dom", 5);
    expect(getEvents()).toEqual([]);
  });

  it("records an event timed from the current navigation", () => {
    startNavigation("/next", 100);
    record(tagged("hero"), "present", "dom", 150);

    expect(getEvents()).toEqual([
      { name: "hero", phase: "present", source: "dom", time: 150, sinceNavigation: 50, navigation: "/next" },
    ]);
  });

  it("defaults the time to performance.now()", () => {
    vi.spyOn(performance, "now").mockReturnValue(42);
    record(tagged("hero"), "present", "dom");
    expect(getEvents()[0].time).toBe(42);
  });

  it("records each (element, phase, source) only once", () => {
    const el = tagged("hero");
    record(el, "present", "dom", 1);
    record(el, "present", "dom", 2);
    record(el, "interactive", "hook", 3);
    record(el, "interactive", "react-internals", 4);

    expect(getEvents().map((e) => `${e.phase}:${e.source}@${e.time}`)).toEqual([
      "present:dom@1",
      "interactive:hook@3",
      "interactive:react-internals@4",
    ]);
  });

  it("tracks different elements with the same name separately", () => {
    record(tagged("row"), "present", "dom", 1);
    record(tagged("row"), "present", "dom", 2);
    expect(getEvents()).toHaveLength(2);
  });

  it("adds a performance mark carrying the event as detail", () => {
    record(tagged("hero"), "present", "dom", 10);
    const [mark] = performance.getEntriesByName("element-timing:hero:present:dom", "mark") as PerformanceMark[];
    expect(mark.startTime).toBe(10);
    expect(mark.detail).toEqual(getEvents()[0]);
  });

  it("measures present-to-interactive once the element is interactive", () => {
    const el = tagged("hero");
    record(el, "present", "dom", 10);
    record(el, "interactive", "hook", 35);

    const [measure] = performance.getEntriesByName("element-timing:hero:present-to-interactive:hook", "measure");
    expect(measure.startTime).toBe(10);
    expect(measure.duration).toBe(25);
  });

  it("skips the measure when the element was never recorded as present", () => {
    record(tagged("hero"), "interactive", "hook", 35);
    expect(performance.getEntriesByType("measure")).toEqual([]);
  });

  it("still records the event when User Timing throws", () => {
    vi.spyOn(performance, "mark").mockImplementation(() => {
      throw new Error("unsupported");
    });
    record(tagged("hero"), "present", "dom", 1);
    expect(getEvents()).toHaveLength(1);
  });

  it("dispatches an element-timing event on window", () => {
    const seen: TimingEvent[] = [];
    const onEvent = (e: Event) => seen.push((e as CustomEvent<TimingEvent>).detail);
    window.addEventListener("element-timing", onEvent);
    record(tagged("hero"), "present", "dom", 1);
    window.removeEventListener("element-timing", onEvent);

    expect(seen).toEqual(getEvents());
  });

  it("names the initial navigation after the page URL", () => {
    history.replaceState(null, "", "/start?q=1");
    record(tagged("hero"), "present", "dom", 1);
    expect(getEvents()[0].navigation).toBe("/start?q=1");
  });

  it("uses an empty navigation when there is no location (server)", () => {
    vi.stubGlobal("location", undefined);
    record(tagged("hero"), "present", "dom", 1);
    expect(getEvents()[0].navigation).toBe("");
  });
});

describe("subscribe and clearEvents", () => {
  it("notifies listeners on record and clear until unsubscribed", () => {
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);

    record(tagged("hero"), "present", "dom", 1);
    expect(listener).toHaveBeenCalledTimes(1);

    clearEvents();
    expect(getEvents()).toEqual([]);
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    record(tagged("other"), "present", "dom", 2);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("replaces the event list rather than mutating it", () => {
    const before = getEvents();
    record(tagged("hero"), "present", "dom", 1);
    expect(before).toEqual([]);
    expect(getEvents()).not.toBe(before);
  });
});

describe("shared state", () => {
  type WithRegistry = { __elementTiming?: { navigation: string } };

  it("lives on window in the browser, so it works without globalThis (Safari 12.0)", () => {
    startNavigation("/browser", 0);
    expect((window as unknown as WithRegistry).__elementTiming?.navigation).toBe("/browser");
  });

  it("falls back to globalThis where there is no window", () => {
    vi.stubGlobal("window", undefined);
    startNavigation("/server", 0);
    expect((globalThis as WithRegistry).__elementTiming?.navigation).toBe("/server");
  });
});
