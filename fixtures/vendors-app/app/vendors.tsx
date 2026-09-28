"use client";

import { useEffect, useState } from "react";

type VendorWindow = Window & {
  newrelic?: { recordCustomEvent?: unknown };
  dynatrace?: { sendEvent?: unknown };
};

/** Loads the vendor scripts `delayMs` after hydration, so events are recorded before they exist. */
export function DelayedVendorScripts({
  delayMs,
  newRelic,
  dynatraceUrl,
}: {
  delayMs: number;
  newRelic?: string;
  dynatraceUrl?: string;
}) {
  useEffect(() => {
    const timer = setTimeout(() => {
      if (newRelic) {
        const script = document.createElement("script");
        script.textContent = newRelic;
        document.head.append(script);
      }
      if (dynatraceUrl) {
        const script = document.createElement("script");
        script.src = dynatraceUrl;
        script.crossOrigin = "anonymous";
        document.head.append(script);
      }
    }, delayMs);
    return () => clearTimeout(timer);
  }, [delayMs, newRelic, dynatraceUrl]);
  return null;
}

function state(configured: boolean, ready: boolean) {
  if (!configured) return "not configured";
  return ready ? "ready" : "waiting for script";
}

/** Shows whether each vendor's API is available yet, i.e. whether its sink can send. */
export function VendorStatus({ newRelic, dynatrace, delayMs }: { newRelic: boolean; dynatrace: boolean; delayMs: number }) {
  const [ready, setReady] = useState({ newRelic: false, dynatrace: false });

  useEffect(() => {
    const check = () => {
      const w = window as VendorWindow;
      setReady({
        newRelic: typeof w.newrelic?.recordCustomEvent === "function",
        dynatrace: typeof w.dynatrace?.sendEvent === "function",
      });
    };
    check();
    const interval = setInterval(check, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <p style={{ color: "GrayText" }}>
      New Relic: {state(newRelic, ready.newRelic)} · Dynatrace: {state(dynatrace, ready.dynatrace)} · vendor scripts{" "}
      {delayMs > 0 ? `delayed ${delayMs} ms` : "in <head>"}
    </p>
  );
}
