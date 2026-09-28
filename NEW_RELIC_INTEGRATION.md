# Send element timings to New Relic

Sends each timing event to New Relic as an `ElementTiming` custom event that you can query in NRQL.

**Before you start:**

- Finish the [quick start](./README.md#quick-start) (or the [Pages Router](./PAGES_ROUTER.md) setup).
- Install the New Relic **browser agent** on your pages, **Pro or Pro+SPA, v1.277.0 or later**. The Lite
  agent and older versions don't have `recordCustomEvent`, so nothing is sent. The copy-paste snippet in
  `<head>` is the usual setup.

## 1. Connect

Call `connectNewRelic()` once in the browser. The simplest place is `instrumentation-client.ts` in your
project root (or `src/`), which Next.js runs on every page before hydration:

```ts
// instrumentation-client.ts
import { connectNewRelic } from "next-element-timing/newrelic";

connectNewRelic();
```

This works alongside `withElementTiming`, and it doesn't matter which runs first. Events recorded before
the New Relic agent loads are held and sent once it's ready.

## 2. Check it worked

Load a page with tagged elements, wait about 30 seconds (the agent uploads in batches), then run this
in New Relic's query builder:

```sql
SELECT elementName, phase, source, sinceNavigation FROM ElementTiming SINCE 30 minutes ago
```

## What's sent

| Attribute         | Meaning                                                                          |
| ----------------- | -------------------------------------------------------------------------------- |
| `elementName`     | The `data-timing` name of the element.                                           |
| `phase`           | `present`, `paint` or `interactive`.                                             |
| `source`          | How the phase was measured; see [What gets measured](./README.md#what-gets-measured). |
| `sinceNavigation` | Milliseconds from the navigation that rendered the element to this phase.        |
| `navigation`      | The URL path of that navigation.                                                 |
| `time`            | Milliseconds since the page's `performance.timeOrigin`.                          |
| `sendDelay`       | Milliseconds between the event and sending it to the agent; see [Timestamps](./TIMESTAMPS.md). |

The agent also adds its usual attributes, such as `pageUrl`, `session`, `appName` and `userAgentName`.

## Example queries

```sql
-- How long until each element is interactive, at the 50th, 75th and 95th percentiles
SELECT percentile(sinceNavigation, 50, 75, 95) FROM ElementTiming
WHERE phase = 'interactive' FACET elementName, source SINCE 1 day ago

-- When each event happened, rather than when it was sent
SELECT elementName, phase, source, timestamp - sendDelay AS happenedAt FROM ElementTiming SINCE 1 hour ago
```

## Options

`connectNewRelic()` accepts the same options as [`connect()`](./CUSTOM_INTEGRATION.md#options), plus:

- `eventType`: the custom event type to query. Defaults to `"ElementTiming"`.

```ts
connectNewRelic({ filter: (e) => e.phase === "interactive", sampleRate: 0.25 });
```

It returns a function that stops sending.

## Troubleshooting

- **No `ElementTiming` events at all:** check the agent tier and version in the snippet (it names the
  loader, such as `nr-loader-spa-1.322.0`). Lite and versions before 1.277.0 can't send custom events.
- **Why `elementName` and not `name`?** The agent sets its own `name` attribute (the page's transaction
  name, such as "Unnamed Transaction") on every event, which would overwrite ours.
- **Events look late on charts:** `timestamp` is when the event reached the agent. Use
  `timestamp - sendDelay` for when it happened; see [Timestamps](./TIMESTAMPS.md).
