"use client";

import { useState, useSyncExternalStore, type CSSProperties } from "react";
import { clearEvents, getEvents, subscribe, type TimingEvent } from "./core.js";

const NO_EVENTS: readonly TimingEvent[] = [];

const COLUMNS = [
  { key: "present:dom", label: "Present" },
  { key: "paint:element-timing", label: "Paint" },
  { key: "interactive:hook", label: "Live (hook)" },
  { key: "interactive:react-internals", label: "Live (internals)" },
] as const;

type Row = { navigation: string; name: string; times: Map<string, number> };

function toRows(events: readonly TimingEvent[]) {
  const rows = new Map<string, Row>();
  for (const e of events) {
    const id = `${e.navigation}\n${e.name}`;
    const row = rows.get(id) ?? { navigation: e.navigation, name: e.name, times: new Map() };
    row.times.set(`${e.phase}:${e.source}`, e.sinceNavigation);
    rows.set(id, row);
  }
  return [...rows.values()].reverse();
}

// Inline styles with CSS system colours, so the panel needs no stylesheet and follows the
// page's light/dark colour scheme.
const styles = {
  panel: {
    position: "fixed",
    bottom: 16,
    right: 16,
    zIndex: 2147483647,
    maxWidth: "calc(100vw - 32px)",
    font: "12px/1.4 system-ui, sans-serif",
    fontVariantNumeric: "tabular-nums",
    color: "CanvasText",
    background: "Canvas",
    border: "1px solid GrayText",
    borderRadius: 8,
    boxShadow: "0 4px 16px rgb(0 0 0 / 0.15)",
  },
  header: { display: "flex", alignItems: "center", gap: 12, padding: "8px 12px" },
  button: { all: "unset", cursor: "pointer" },
  title: { fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" },
  muted: { color: "GrayText" },
  body: { maxHeight: 288, overflow: "auto", borderTop: "1px solid GrayText" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { padding: "4px 8px", fontWeight: 500, color: "GrayText", textAlign: "right" },
  td: { padding: "4px 8px", textAlign: "right", borderTop: "1px solid GrayText" },
} satisfies Record<string, CSSProperties>;

/** Overlay listing element timings (ms since the navigation that rendered each element). */
export function TimingPanel({ defaultOpen = true }: { defaultOpen?: boolean }) {
  const events = useSyncExternalStore(subscribe, getEvents, () => NO_EVENTS);
  const [open, setOpen] = useState(defaultOpen);
  const rows = toRows(events);

  return (
    <aside style={styles.panel}>
      <div style={styles.header}>
        <button type="button" onClick={() => setOpen(!open)} style={{ ...styles.button, ...styles.title }}>
          Element timing {open ? "▾" : "▸"}
        </button>
        {open && rows.length > 0 && (
          <button type="button" onClick={clearEvents} style={{ ...styles.button, ...styles.muted, marginLeft: "auto" }}>
            Clear
          </button>
        )}
      </div>
      {open && (
        <div style={styles.body}>
          {rows.length === 0 ? (
            <p style={{ ...styles.muted, margin: 0, padding: "8px 12px" }}>No [data-timing] elements yet.</p>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={{ ...styles.th, textAlign: "left", paddingLeft: 12 }}>Element</th>
                  {COLUMNS.map((c) => (
                    <th key={c.key} style={styles.th}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.navigation}\n${row.name}`}>
                    <td style={{ ...styles.td, textAlign: "left", paddingLeft: 12 }}>
                      <div style={{ fontWeight: 600 }}>{row.name}</div>
                      <div style={styles.muted}>{row.navigation}</div>
                    </td>
                    {COLUMNS.map((c) => {
                      const ms = row.times.get(c.key);
                      return (
                        <td key={c.key} style={styles.td}>
                          {ms === undefined ? "—" : `${Math.round(ms)} ms`}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </aside>
  );
}
