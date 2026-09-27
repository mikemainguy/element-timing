// Pages Router navigation tracking. The App Router calls onRouterTransitionStart from the
// client module; the Pages Router never does, so forward its router events instead.
//
// The router is passed in rather than imported so this package never pulls `next/router`
// into App Router bundles.

import { startNavigation } from "./core.js";

type RouteChangeHandler = (url: string) => void;

/** The subset of `next/router`'s `Router` that this needs. */
export type PagesRouterLike = {
  events: {
    on(type: "routeChangeStart", handler: RouteChangeHandler): void;
    off(type: "routeChangeStart", handler: RouteChangeHandler): void;
  };
};

/**
 * Restart element timings on each Pages Router navigation. Returns a function that stops tracking.
 *
 *   import Router from "next/router";
 *   trackPagesRouter(Router);
 */
export function trackPagesRouter(router: PagesRouterLike) {
  const onStart: RouteChangeHandler = (url) => startNavigation(url);
  router.events.on("routeChangeStart", onStart);
  return () => router.events.off("routeChangeStart", onStart);
}
