import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getEvents, record, startNavigation } from "../src/core.js";
import { TimingPanel } from "../src/panel.js";
import { resetRegistry, tagged } from "./helpers.js";

beforeEach(resetRegistry);
afterEach(cleanup);

describe("TimingPanel", () => {
  it("shows an empty state until elements are recorded", () => {
    render(<TimingPanel />);
    expect(screen.getByText("No [data-timing] elements yet.")).toBeTruthy();
    expect(screen.queryByText("Clear")).toBeNull();
  });

  it("lists one row per element and navigation, newest first, with rounded times", () => {
    render(<TimingPanel />);

    act(() => {
      startNavigation("/", 0);
      const hero = tagged("hero");
      record(hero, "present", "dom", 10.4);
      record(hero, "interactive", "hook", 20.6);
      startNavigation("/two", 100);
      record(tagged("buy"), "paint", "element-timing", 150);
    });

    const [, first, second] = screen.getAllByRole("row");
    expect(within(first).getAllByRole("cell").map((c) => c.textContent)).toEqual([
      "buy/two",
      "—",
      "50 ms",
      "—",
      "—",
    ]);
    expect(within(second).getAllByRole("cell").map((c) => c.textContent)).toEqual([
      "hero/",
      "10 ms",
      "—",
      "21 ms",
      "—",
    ]);
  });

  it("clears the recorded events", () => {
    render(<TimingPanel />);
    act(() => record(tagged("hero"), "present", "dom", 1));

    fireEvent.click(screen.getByText("Clear"));
    expect(getEvents()).toEqual([]);
    expect(screen.getByText("No [data-timing] elements yet.")).toBeTruthy();
  });

  it("collapses and expands from the title", () => {
    render(<TimingPanel defaultOpen={false} />);
    expect(screen.queryByText("No [data-timing] elements yet.")).toBeNull();

    fireEvent.click(screen.getByText(/Element timing/));
    expect(screen.getByText("No [data-timing] elements yet.")).toBeTruthy();
  });

  it("renders an empty panel on the server", () => {
    record(tagged("hero"), "present", "dom", 1);
    expect(renderToString(<TimingPanel />)).toContain("No [data-timing] elements yet.");
  });
});
