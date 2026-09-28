import { describe, expect, it } from "vitest";
import * as api from "../src/index.js";

describe("package entry point", () => {
  it("exports the public API", () => {
    expect(Object.keys(api).sort()).toEqual([
      "TIMING_ATTR",
      "clearEvents",
      "connect",
      "getEvents",
      "record",
      "startNavigation",
      "subscribe",
      "timingProps",
      "trackPagesRouter",
    ]);
  });
});
