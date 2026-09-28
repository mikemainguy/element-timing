import { beforeEach, describe, expect, it, vi } from "vitest";
import { getEvents } from "../src/core.js";
import { timingProps } from "../src/timed.js";
import { resetRegistry } from "./helpers.js";

beforeEach(resetRegistry);

describe("timingProps", () => {
  it("tags the element for both data-timing and the Element Timing API", () => {
    expect(timingProps("buy")).toEqual({ ref: expect.any(Function), "data-timing": "buy", elementtiming: "buy" });
  });

  it("uses one stable ref for every element", () => {
    expect(timingProps("a").ref).toBe(timingProps("b").ref);
  });

  it("records present and interactive when React attaches the ref", () => {
    vi.spyOn(performance, "now").mockReturnValue(75);
    const { ref, ...attrs } = timingProps("buy");
    const el = document.createElement("button");
    for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);

    ref(el);

    expect(getEvents()).toMatchObject([
      { name: "buy", phase: "present", source: "dom", time: 75 },
      { name: "buy", phase: "interactive", source: "hook", time: 75 },
    ]);
  });

  it("ignores the null call React makes on unmount", () => {
    timingProps("buy").ref(null);
    expect(getEvents()).toEqual([]);
  });
});
