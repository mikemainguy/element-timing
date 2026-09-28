export {
  TIMING_ATTR,
  clearEvents,
  getEvents,
  record,
  startNavigation,
  subscribe,
  type TimingEvent,
  type TimingPhase,
  type TimingSource,
} from "./core.js";
export { trackPagesRouter, type PagesRouterLike } from "./pages.js";
export { connect, type ConnectOptions, type TimingSink } from "./sinks.js";
export { timingProps } from "./timed.js";

// Lets `elementtiming="…"` (the Element Timing API attribute) type-check in JSX.
declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- must match React's declaration to merge
  interface HTMLAttributes<T> {
    elementtiming?: string;
  }
}
