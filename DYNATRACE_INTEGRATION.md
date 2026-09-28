# Send element timings to Dynatrace

Sends each timing event to Dynatrace RUM as a custom user event that you can query with DQL.

**Before you start:**

- Finish the [quick start](./README.md#quick-start) (or the [Pages Router](./PAGES_ROUTER.md) setup).
- Monitor your pages with a Dynatrace **web frontend using the new RUM experience**, either with
  OneAgent injection or agentless with the JavaScript tag. RUM Classic (`dtrum`) isn't supported.

## 1. Allow the event properties

Dynatrace **discards event properties that aren't on the frontend's allow list**, so do this first.

1. In **Experience Vitals**, open your web frontend.
2. Go to **Settings** → **Capture properties** → **Allowed API-reported properties**.
3. Select **New property** and add each of these keys. Leave off the `event_properties.` prefix;
   Dynatrace adds it.
   - `element_timing_name`
   - `element_timing_phase`
   - `element_timing_source`
   - `element_timing_since_navigation`
   - `element_timing_navigation`
   - `element_timing_send_delay`

Use **Allowed API-reported properties**, not **Captured event properties**. Changes can take a few
minutes to reach browsers, because the Dynatrace script caches its settings.

## 2. Connect

Call `connectDynatrace()` once in the browser. The simplest place is `instrumentation-client.ts` in your
project root (or `src/`), which Next.js runs on every page before hydration:

```ts
// instrumentation-client.ts
import { connectDynatrace } from "next-element-timing/dynatrace";

connectDynatrace();
```

This works alongside `withElementTiming`, and it doesn't matter which runs first. Events recorded before
the Dynatrace script loads are held and sent once it's ready.

## 3. Check it worked

Load a page with tagged elements, wait a minute or two, then run this in a Dynatrace notebook:

```
fetch user.events, from: -30m
| filter isNotNull(event_properties.element_timing_name)
| fields end_time, event_properties.element_timing_name, event_properties.element_timing_phase,
    event_properties.element_timing_source, event_properties.element_timing_since_navigation
```

## What's sent

| Property (`event_properties.…`)   | Meaning                                                                  |
| --------------------------------- | ------------------------------------------------------------------------ |
| `element_timing_name`             | The `data-timing` name of the element.                                   |
| `element_timing_phase`            | `present`, `paint` or `interactive`.                                     |
| `element_timing_source`           | How the phase was measured; see [What gets measured](./README.md#what-gets-measured). |
| `element_timing_since_navigation` | Milliseconds from the navigation that rendered the element to this phase. |
| `element_timing_navigation`       | The URL path of that navigation.                                         |
| `element_timing_send_delay`       | Milliseconds between the event and sending it; see [Timestamps](./TIMESTAMPS.md). |

Each event's `duration` is `sinceNavigation`, rounded to whole milliseconds. The keys are exported as
`EVENT_PROPERTIES` from `next-element-timing/dynatrace`.

## Example queries

```
// Interactive times per element, at the 50th and 95th percentiles
fetch user.events
| filter event_properties.element_timing_phase == "interactive"
| summarize p50 = percentile(toDouble(event_properties.element_timing_since_navigation), 50),
            p95 = percentile(toDouble(event_properties.element_timing_since_navigation), 95),
            by: { event_properties.element_timing_name, event_properties.element_timing_source }

// When each event happened, rather than when it was sent
fetch user.events
| filter isNotNull(event_properties.element_timing_name)
| fieldsAdd happened_at = end_time - duration(toLong(event_properties.element_timing_send_delay), "ms")
```

## Options

`connectDynatrace()` accepts the same options as [`connect()`](./CUSTOM_INTEGRATION.md#options):

```ts
connectDynatrace({ filter: (e) => e.phase === "interactive", sampleRate: 0.25 });
```

It returns a function that stops sending.

## Troubleshooting

- **Events arrive but without the `element_timing_*` properties:** they're not on the allow list yet,
  or the list changed in the last few minutes. Dynatrace records what it dropped:

  ```
  fetch user.events, from: -1h
  | filter characteristics.is_api_reported == true and isNotNull(dt.support.dropped_custom_properties)
  | fields end_time, dt.support.dropped_custom_properties
  ```

- **Events look late on the timeline:** Dynatrace ignores a start time sent from the page and places the
  event so it ends when it was sent. Use `end_time - element_timing_send_delay` for when it happened;
  see [Timestamps](./TIMESTAMPS.md).
