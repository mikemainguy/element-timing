import { describe, expect, it } from "vitest";
import { withElementTiming } from "../src/next.js";

const CLIENT = "next-element-timing/client";

describe("withElementTiming", () => {
  it("injects the client module into an empty config", () => {
    expect(withElementTiming()).toEqual({ instrumentationClientInject: [CLIENT] });
  });

  it("keeps the rest of the config and any other injected modules", () => {
    expect(withElementTiming({ reactStrictMode: true, instrumentationClientInject: ["other"] })).toEqual({
      reactStrictMode: true,
      instrumentationClientInject: ["other", CLIENT],
    });
  });

  it("does not inject the client module twice", () => {
    expect(withElementTiming({ instrumentationClientInject: [CLIENT] }).instrumentationClientInject).toEqual([CLIENT]);
  });
});
