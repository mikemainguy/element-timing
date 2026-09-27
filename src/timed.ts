// Supported "handler is live" detection, for use in client components.
//
// React attaches refs in the commit phase, after hydration has stored the element's props —
// so when this ref fires, the element's handlers will respond to events.
//
//   <button {...timingProps("add-to-bag")} onClick={...}>Add to bag</button>
//
// The ref is a module-level function, so its identity is stable and it's safe to use in loops.

import type { RefCallback } from "react";
import { record, TIMING_ATTR } from "./core.js";

const markInteractive: RefCallback<Element> = (el) => {
  if (!el) return;
  // For client-rendered elements the ref fires in the commit, before the MutationObserver
  // callback runs — so the element is present no later than now.
  const now = performance.now();
  record(el, "present", "dom", now);
  record(el, "interactive", "hook", now);
};

export function timingProps(name: string) {
  return { ref: markInteractive, [TIMING_ATTR]: name, elementtiming: name } as {
    ref: RefCallback<Element>;
    "data-timing": string;
    elementtiming: string;
  };
}
