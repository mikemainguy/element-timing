import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearEvents, getEvents, record, type TimingEvent } from "../src/core.js";
import { connect, type TimingSink } from "../src/sinks.js";
import { resetRegistry, tagged } from "./helpers.js";

beforeEach(() => {
  resetRegistry();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
});

afterEach(() => {
  vi.useRealTimers();
});

function fakeSink(ready = true) {
  const sent: TimingEvent[] = [];
  const sink: TimingSink & { ready: boolean } = {
    name: "fake",
    ready,
    isReady: () => sink.ready,
    send: (event) => void sent.push(event),
  };
  return { sink, sent };
}

const present = (name: string) => record(tagged(name), "present", "dom");

describe("connect", () => {
  it("replays events recorded before it was called, then delivers new ones", () => {
    present("early");
    const { sink, sent } = fakeSink();

    connect(sink);
    present("late");

    expect(sent.map((e) => e.name)).toEqual(["early", "late"]);
  });

  it("holds events until the sink is ready, polling for it", () => {
    present("early");
    const { sink, sent } = fakeSink(false);

    connect(sink, { retryMs: 100 });
    present("waiting");
    expect(vi.getTimerCount()).toBe(1);

    vi.advanceTimersByTime(100);
    expect(sent).toEqual([]);

    sink.ready = true;
    vi.advanceTimersByTime(100);
    expect(sent.map((e) => e.name)).toEqual(["early", "waiting"]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("doesn't poll while nothing is waiting", () => {
    connect(fakeSink(false).sink);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stops polling after the timeout but delivers once a later event finds the sink ready", () => {
    const { sink, sent } = fakeSink(false);
    connect(sink, { retryMs: 100, timeoutMs: 250 });
    present("early");

    vi.advanceTimersByTime(300);
    expect(vi.getTimerCount()).toBe(0);

    sink.ready = true;
    present("late");
    expect(sent.map((e) => e.name)).toEqual(["early", "late"]);
  });

  it("delivers each event once, even to a sink that records while sending", () => {
    const sent: string[] = [];
    const sink: TimingSink = {
      name: "reentrant",
      isReady: () => true,
      send: (event) => {
        sent.push(event.name);
        if (event.name === "first") present("second");
      },
    };

    connect(sink);
    present("first");

    expect(sent).toEqual(["first", "second"]);
  });

  it("delivers only events that pass the filter", () => {
    const { sink, sent } = fakeSink();
    connect(sink, { filter: (e) => e.phase === "interactive" });

    const el = tagged("buy");
    record(el, "present", "dom");
    record(el, "interactive", "hook");

    expect(sent.map((e) => e.phase)).toEqual(["interactive"]);
  });

  it("reports every event from a sampled page and none from an unsampled one", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.4);
    const sampled = fakeSink();
    const unsampled = fakeSink();

    connect(sampled.sink, { sampleRate: 0.5 });
    connect(unsampled.sink, { sampleRate: 0.3 });
    present("a");
    present("b");

    expect(sampled.sent).toHaveLength(2);
    expect(unsampled.sent).toEqual([]);
  });

  it("treats a sample rate of 0 as never reporting", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const { sink, sent } = fakeSink();
    connect(sink, { sampleRate: 0 });
    present("a");
    expect(sent).toEqual([]);
  });

  it("does nothing on the server", () => {
    vi.stubGlobal("window", undefined);
    const isReady = vi.fn(() => true);
    const disconnect = connect({ name: "server", isReady, send: () => {} });

    expect(isReady).not.toHaveBeenCalled();
    expect(() => disconnect()).not.toThrow();
  });

  it("stops delivering and polling once disconnected", () => {
    const { sink, sent } = fakeSink(false);
    const disconnect = connect(sink);
    present("a");
    expect(vi.getTimerCount()).toBe(1);

    disconnect();
    expect(vi.getTimerCount()).toBe(0);

    sink.ready = true;
    present("b");
    expect(sent).toEqual([]);
  });

  it("drops events cleared before the sink was ready", () => {
    const { sink, sent } = fakeSink(false);
    connect(sink);
    present("cleared");
    clearEvents();

    sink.ready = true;
    present("kept");
    expect(sent.map((e) => e.name)).toEqual(["kept"]);
  });

  it("keeps delivering the rest when send throws, warning once, and never retries the failed event", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const sent: string[] = [];
    connect({
      name: "flaky",
      isReady: () => true,
      send: (event) => {
        if (event.name.startsWith("bad")) throw new Error("boom");
        sent.push(event.name);
      },
    });

    present("bad1");
    present("good");
    present("bad2");

    expect(sent).toEqual(["good"]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('[element-timing] sink "flaky" failed', expect.any(Error));
  });

  it("treats an isReady that throws as not ready", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const send = vi.fn();
    connect({
      name: "broken",
      isReady: () => {
        throw new Error("no agent");
      },
      send,
    });

    present("a");
    expect(send).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith('[element-timing] sink "broken" failed', expect.any(Error));
  });

  it("delivers to each connected sink independently", () => {
    const a = fakeSink();
    const b = fakeSink(false);
    connect(a.sink);
    connect(b.sink);

    present("x");
    expect(a.sent).toHaveLength(1);
    expect(b.sent).toEqual([]);

    b.sink.ready = true;
    vi.advanceTimersByTime(250);
    expect(b.sent).toEqual(getEvents());
  });
});
