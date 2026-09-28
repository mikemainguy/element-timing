# Custom integrations and the full API

For sending timings somewhere other than [New Relic](./NEW_RELIC_INTEGRATION.md) or
[Dynatrace](./DYNATRACE_INTEGRATION.md): your own analytics endpoint, another monitoring tool, or code
of your own.

## Sinks (recommended)

A sink hands one event to your tool. `connect()` takes care of everything else: it replays events
recorded before it was called, waits until your tool is ready, sends each event once and keeps a failing
sink from breaking the page. Call it once in the browser, for example in `instrumentation-client.ts`.

Sending to your own endpoint:

```ts
// instrumentation-client.ts
import { connect } from "next-element-timing";

connect({
  name: "beacon",
  isReady: () => true,
  send: (event) =>
    navigator.sendBeacon(
      "/analytics",
      JSON.stringify({ ...event, sendDelay: Math.round(performance.now() - event.time) }),
    ),
});
```

Sending to a tool whose script loads separately:

```ts
import { connect, type TimingSink } from "next-element-timing";

// Replace with your tool's browser API.
const tool = () => (window as Window & { myTool?: { track(type: string, data: object): void } }).myTool;

const sink: TimingSink = {
  name: "my-tool",
  isReady: () => typeof tool()?.track === "function",
  send: (event) => tool()!.track("ElementTiming", { ...event, sendDelay: Math.round(performance.now() - event.time) }),
};

const disconnect = connect(sink, { filter: (e) => e.phase === "interactive", sampleRate: 0.1 });
```

**Include the send delay** (`performance.now() - event.time`) as above. `send()` can run seconds after
the event happened, when events are replayed after your tool loads. If your tool stamps events when it
receives them, the delay is how you recover when they happened. See [Timestamps](./TIMESTAMPS.md).

### Options

| Option       | Default | Meaning                                                                             |
| ------------ | ------- | ----------------------------------------------------------------------------------- |
| `filter`     | all     | Only send events this returns `true` for.                                           |
| `sampleRate` | `1`     | Fraction of page loads (0–1) that report. Decided once per `connect()` call, so a sampled page load reports all its events. |
| `retryMs`    | `250`   | How often to check `isReady()` while events are waiting.                            |
| `timeoutMs`  | `30000` | Stop polling `isReady()` after this long. After that it checks again only when a new event is recorded. |

`connect()` delivers each event once, catches errors from the sink (logging only the first), and does
nothing on the server. Events cleared with `clearEvents()` before the sink is ready are not delivered.
It returns a function that disconnects the sink.

## Other ways to read the data

- **Window event:** each event is dispatched on `window` as `element-timing`, with the event as
  `detail`. Useful for reacting to events as they happen, but a listener only sees events fired after it
  was added. The client module records from before hydration, so use a sink if you need every event.
- **Performance timeline:** each event is also a `performance.mark` named
  `element-timing:<name>:<phase>:<source>`, and interactive events add a `performance.measure` named
  `element-timing:<name>:present-to-interactive:<source>`. They show up in browser dev tools, and in
  monitoring tools that capture marks and measures.
- **API:** from `next-element-timing`:
  - `getEvents()`: every event recorded so far.
  - `subscribe(listener)`: call `listener` whenever the list changes. Returns an unsubscribe function.
  - `clearEvents()`: empty the list.
  - `connect(sink, options)`: see [Sinks](#sinks-recommended).
  - `startNavigation(url)`: restart navigation timing yourself (the App Router and
    `trackPagesRouter` do this for you).
  - `trackPagesRouter(router)`: see [Pages Router](./PAGES_ROUTER.md).

Each event is an object with `name`, `phase`, `source`, `time` (ms since `performance.timeOrigin`),
`sinceNavigation` and `navigation`.
