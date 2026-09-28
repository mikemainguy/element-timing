import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getEvents } from "../src/core.js";
import { resetRegistry, setReactProps, tagged } from "./helpers.js";

// The poller keeps module-level state, so each test gets a fresh copy.
let watchReactHandlers: typeof import("../src/react-internals.js").watchReactHandlers;

beforeEach(async () => {
  resetRegistry();
  vi.useFakeTimers({ toFake: ["setTimeout", "performance"] });
  vi.resetModules();
  ({ watchReactHandlers } = await import("../src/react-internals.js"));
});

afterEach(() => {
  vi.useRealTimers();
});

function connected(name: string) {
  const el = tagged(name, "button");
  document.body.append(el);
  return el;
}

const interactive = () => getEvents().filter((e) => e.phase === "interactive");

describe("watchReactHandlers", () => {
  it("records interactive once React has stored an on* handler", () => {
    const el = connected("buy");
    watchReactHandlers(el);

    vi.advanceTimersByTime(16);
    expect(interactive()).toEqual([]);

    setReactProps(el, { onClick: () => {} });
    vi.advanceTimersByTime(16);

    expect(interactive()).toMatchObject([{ name: "buy", source: "react-internals", time: 32 }]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps polling while the stored props have no handler functions", () => {
    const el = connected("buy");
    (el as unknown as Record<string, unknown>).unrelated = true;
    setReactProps(el, { className: "x", onClick: "not a function", once: () => {} });
    watchReactHandlers(el);

    vi.advanceTimersByTime(160);
    expect(interactive()).toEqual([]);
    expect(vi.getTimerCount()).toBe(1);
  });

  it("stops watching an element removed from the document", () => {
    const el = connected("buy");
    watchReactHandlers(el);
    el.remove();

    vi.advanceTimersByTime(16);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("gives up after 30 seconds", () => {
    watchReactHandlers(connected("buy"));

    vi.advanceTimersByTime(30_000);
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(16);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("shares one timer across elements and ignores repeat watches", () => {
    const a = connected("a");
    const b = connected("b");
    watchReactHandlers(a);
    watchReactHandlers(a);
    watchReactHandlers(b);
    expect(vi.getTimerCount()).toBe(1);

    setReactProps(a, { onClick: () => {} });
    vi.advanceTimersByTime(16);
    expect(interactive().map((e) => e.name)).toEqual(["a"]);
    expect(vi.getTimerCount()).toBe(1);

    setReactProps(b, { onChange: () => {} });
    vi.advanceTimersByTime(16);
    expect(interactive().map((e) => e.name)).toEqual(["a", "b"]);
    expect(vi.getTimerCount()).toBe(0);
  });
});
