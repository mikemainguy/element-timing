import { readFileSync } from "node:fs";
import type { ReactNode } from "react";
import { TimingPanel } from "next-element-timing/panel";
import { DelayedVendorScripts, VendorStatus } from "./vendors";

// Configuration is read per request from the environment scripts/harness.sh sets.
export const dynamic = "force-dynamic";

function newRelicSnippet() {
  const path = process.env.HARNESS_NEW_RELIC_SNIPPET;
  if (!path) return undefined;
  // New Relic's UI gives the snippet wrapped in <script> tags; keep only the JavaScript.
  return readFileSync(path, "utf8").replace(/<\/?script[^>]*>/gi, "").trim();
}

export default function RootLayout({ children }: { children: ReactNode }) {
  const newRelic = newRelicSnippet();
  const dynatraceUrl = process.env.DYNATRACE_RUM_SCRIPT_URL || undefined;
  const delayMs = Number(process.env.HARNESS_DELAY_MS) || 0;

  return (
    <html lang="en">
      <head>
        {delayMs === 0 && newRelic && <script dangerouslySetInnerHTML={{ __html: newRelic }} />}
        {delayMs === 0 && dynatraceUrl && <script src={dynatraceUrl} crossOrigin="anonymous" />}
      </head>
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 24 }}>
        {delayMs > 0 && <DelayedVendorScripts delayMs={delayMs} newRelic={newRelic} dynatraceUrl={dynatraceUrl} />}
        <VendorStatus newRelic={Boolean(newRelic)} dynatrace={Boolean(dynatraceUrl)} delayMs={delayMs} />
        {children}
        <TimingPanel />
      </body>
    </html>
  );
}
