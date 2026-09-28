import { beforeEach, describe, expect, it, vi } from "vitest";
import { getEvents, record } from "../src/core.js";
import { trackPagesRouter, type PagesRouterLike } from "../src/pages.js";
import { resetRegistry, tagged } from "./helpers.js";

beforeEach(resetRegistry);

function fakeRouter() {
  const handlers = new Set<(url: string) => void>();
  const router: PagesRouterLike = {
    events: {
      on: (_type, handler) => handlers.add(handler),
      off: (_type, handler) => handlers.delete(handler),
    },
  };
  return { router, handlers, navigate: (url: string) => handlers.forEach((h) => h(url)) };
}

describe("trackPagesRouter", () => {
  it("restarts navigation timing on routeChangeStart until stopped", () => {
    const { router, handlers, navigate } = fakeRouter();
    const stop = trackPagesRouter(router);

    vi.spyOn(performance, "now").mockReturnValue(500);
    navigate("/two");
    record(tagged("hero"), "present", "dom", 530);
    expect(getEvents()[0]).toMatchObject({ navigation: "/two", sinceNavigation: 30 });

    stop();
    expect(handlers.size).toBe(0);
  });
});
