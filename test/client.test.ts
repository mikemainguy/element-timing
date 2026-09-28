import { beforeEach, describe, expect, it, vi } from "vitest";
import { getEvents } from "../src/core.js";
import { resetRegistry, tagged } from "./helpers.js";

type ElementEntry = { element: Element | null; renderTime: number; loadTime: number };

/** Stands in for PerformanceObserver so tests can deliver Element Timing entries. */
function stubPerformanceObserver(supportedEntryTypes: string[]) {
  const observers: { callback: (list: { getEntries(): ElementEntry[] }) => void; options?: unknown }[] = [];
  class FakePerformanceObserver {
    static supportedEntryTypes = supportedEntryTypes;
    constructor(public callback: (list: { getEntries(): ElementEntry[] }) => void) {}
    observe(options: unknown) {
      observers.push({ callback: this.callback, options });
    }
  }
  vi.stubGlobal("PerformanceObserver", FakePerformanceObserver);
  return {
    observers,
    deliver: (entries: ElementEntry[]) => observers.forEach((o) => o.callback({ getEntries: () => entries })),
  };
}

async function loadClient() {
  vi.resetModules();
  return import("../src/client.js");
}

const flushMutations = () => new Promise((resolve) => setTimeout(resolve));
const names = (phase: string) => getEvents().filter((e) => e.phase === phase).map((e) => e.name);

beforeEach(resetRegistry);

describe("client instrumentation", () => {
  it("records server-rendered tagged elements as present when it loads", async () => {
    stubPerformanceObserver([]);
    document.body.append(tagged("hero"), document.createElement("div"));

    await loadClient();
    expect(names("present")).toEqual(["hero"]);
  });

  it("records tagged elements added later, including nested ones", async () => {
    stubPerformanceObserver([]);
    await loadClient();

    const wrapper = tagged("card");
    wrapper.append(tagged("buy"));
    document.body.append(wrapper, document.createTextNode("text"));
    await flushMutations();

    expect(names("present")).toEqual(["card", "buy"]);
  });

  it("records paint from Element Timing entries, falling back to loadTime", async () => {
    const perf = stubPerformanceObserver(["element"]);
    await loadClient();
    expect(perf.observers[0].options).toEqual({ type: "element", buffered: true });

    const painted = tagged("hero");
    const crossOrigin = tagged("logo", "img");
    perf.deliver([
      { element: painted, renderTime: 120, loadTime: 90 },
      { element: crossOrigin, renderTime: 0, loadTime: 80 },
      { element: null, renderTime: 50, loadTime: 50 },
    ]);

    expect(getEvents().filter((e) => e.phase === "paint")).toMatchObject([
      { name: "hero", source: "element-timing", time: 120 },
      { name: "logo", source: "element-timing", time: 80 },
    ]);
  });

  it("skips paint where the Element Timing API is unsupported", async () => {
    const perf = stubPerformanceObserver(["navigation"]);
    await loadClient();
    expect(perf.observers).toEqual([]);
  });

  it("warns instead of throwing when instrumentation cannot start", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal(
      "MutationObserver",
      class {
        constructor() {
          throw new Error("unavailable");
        }
      },
    );

    await loadClient();
    expect(warn).toHaveBeenCalledWith("[element-timing] instrumentation failed to start", expect.any(Error));
  });

  it("restarts navigation timing on App Router transitions", async () => {
    stubPerformanceObserver([]);
    const { onRouterTransitionStart } = await loadClient();

    vi.spyOn(performance, "now").mockReturnValue(1000);
    onRouterTransitionStart("/checkout");
    document.body.append(tagged("pay"));
    await flushMutations();

    expect(getEvents().find((e) => e.name === "pay")).toMatchObject({ navigation: "/checkout", sinceNavigation: 0 });
  });
});
