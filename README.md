# next-element-timing

Measure when specific elements in a Next.js app **appear**, **paint**, and become
**interactive**, meaning React has hydrated them and their event handlers will respond.

Works with React 19 (App Router) and React 18 (Pages Router).

## Which React version am I on?

The App Router always runs Next.js's built-in React canary (19.x), whatever React your
`package.json` lists. Only the Pages Router uses your installed React. In practice:

| Your app                           | React used | Follow                                |
| ---------------------------------- | ---------- | ------------------------------------- |
| App Router (`app/`)                | 19         | [React 19 / App Router](#react-19--app-router) |
| Pages Router (`pages/`), React 19  | 19         | [React 18 or 19 / Pages Router](#react-18-or-19--pages-router) |
| Pages Router (`pages/`), React 18  | 18         | [React 18 or 19 / Pages Router](#react-18-or-19--pages-router) |

Both versions work because React 18 and 19 attach refs the same way and store
event handlers under the same `__reactProps$` key. React 16 and earlier are not supported.

## React 19 / App Router

Requires Next.js 16.3+ for the config wrapper, or 15.3+ with the manual `instrumentation-client` option below.

**1. Load the client module before hydration:**

```ts
// next.config.ts
import { withElementTiming } from "next-element-timing/next";

export default withElementTiming({
  /* your config */
});
```

This registers `next-element-timing/client` through `instrumentationClientInject` (Next 16.3+).
On Next 15.3–16.2, or if you'd rather wire it yourself, re-export it from your own
`instrumentation-client.ts` instead:

```ts
// instrumentation-client.ts
export * from "next-element-timing/client";
```

Client-side navigations are tracked for you: the client module exports
`onRouterTransitionStart`, so timings restart from each navigation.

**2. Tag elements.** In client components, use `timingProps`. Its ref records "interactive" at
hydration commit using only supported React APIs:

```tsx
"use client";
import { timingProps } from "next-element-timing";

<button {...timingProps("add-to-bag")} onClick={add}>Add to bag</button>
```

In server components you can't pass a ref, so add the attributes directly. The client module
then detects "interactive" on its own by reading React's private props key:

```tsx
<Link href="/" data-timing="logo" elementtiming="logo">Home</Link>
```

**3. Optional overlay.** Render `<TimingPanel />` from `next-element-timing/panel` in `app/layout.tsx`.

## React 18 or 19 / Pages Router

Requires Next.js 16.3+ for the config wrapper, or 15.3+ with the manual `instrumentation-client` option.
Tested with React 18.3.1 on Next 16.3.6 (see [Development](#development)).

**1. Load the client module before hydration.** Same as the App Router: use
`withElementTiming` in `next.config`, or re-export from `instrumentation-client.ts`. The Pages
Router loads it before `hydrate()` too.

**2. Track navigations.** The Pages Router never calls `onRouterTransitionStart`, so
without this step, times after a client-side navigation are measured from the first page load.
Pass the router to `trackPagesRouter` in `pages/_app.tsx`. It takes the router as an argument
instead of importing `next/router`, so App Router apps never bundle it:

```tsx
// pages/_app.tsx
import type { AppProps } from "next/app";
import Router from "next/router";
import { trackPagesRouter } from "next-element-timing";
import { TimingPanel } from "next-element-timing/panel";

trackPagesRouter(Router); // returns a function that stops tracking

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Component {...pageProps} />
      <TimingPanel />
    </>
  );
}
```

**3. Tag elements.** In the Pages Router every component is a client component, so you can use
`timingProps` anywhere. Plain attributes work too:

```tsx
import Link from "next/link";
import { timingProps } from "next-element-timing";

<button {...timingProps("counter")} onClick={increment}>Add</button>
<Link href="/two" data-timing="to-two" elementtiming="to-two">Page two</Link>
```

**Next.js 13 – 15.2 (untested).** These versions have no `instrumentation-client`. Import the
client module for its side effects as the first line of `pages/_app.tsx`
(`import "next-element-timing/client";`) so it runs before hydration, and keep the
`trackPagesRouter` call from step 2.

## Phases and sources

| phase         | source            | how it's measured                                                              |
| ------------- | ----------------- | ------------------------------------------------------------------------------ |
| `present`     | `dom`             | MutationObserver; for server-rendered HTML, when the client module ran (upper bound) |
| `paint`       | `element-timing`  | [Element Timing API](https://developer.mozilla.org/docs/Web/API/PerformanceElementTiming) (Chromium only; needs `elementtiming`) |
| `interactive` | `hook`            | `timingProps` ref, fired in React's commit phase                               |
| `interactive` | `react-internals` | polls every 16 ms for an `on*` handler under `__reactProps$…`; **React-internal and may break on upgrade** |

Times are reported as `sinceNavigation`, meaning milliseconds since the initial page load or the client-side
transition that rendered the element.

## Consume the data

- **Overlay:** `import { TimingPanel } from "next-element-timing/panel"` and render `<TimingPanel />`
  in your root layout.
- **Performance timeline:** each event is a `performance.mark` named
  `element-timing:<name>:<phase>:<source>`. It also adds a `performance.measure` named
  `element-timing:<name>:present-to-interactive:<source>`.
- **Events:** each event is dispatched on `window` as `element-timing`, with the event object as `detail`.
  Send it to your analytics:

  ```ts
  window.addEventListener("element-timing", (e) => {
    navigator.sendBeacon("/analytics", JSON.stringify((e as CustomEvent).detail));
  });
  ```

- **Sinks:** to send events to a monitoring tool, implement a `TimingSink` and pass it to `connect()` from
  a client component or your instrumentation-client file:

  ```ts
  import { connect, type TimingSink } from "next-element-timing";

  const sink: TimingSink = {
    name: "my-vendor",
    isReady: () => typeof window.myVendor !== "undefined",
    send: (event) => window.myVendor.track("ElementTiming", event),
  };

  const disconnect = connect(sink, { filter: (e) => e.phase === "interactive", sampleRate: 0.1 });
  ```

  `connect` replays events recorded before it was called and holds events until `isReady()` is true,
  checking every `retryMs` (250 ms) for up to `timeoutMs` (30 s). After that it checks again only when
  a new event is recorded. It delivers each event once and catches errors from the sink, logging only
  the first. `sampleRate` is decided once per `connect()` call, so a sampled page load reports all its
  events. Events cleared with `clearEvents()` before the sink is ready are not delivered.

- **New Relic:** call `connectNewRelic()` once on the client, for example in your instrumentation-client
  file after the client module:

  ```ts
  import { connectNewRelic } from "next-element-timing/newrelic";

  connectNewRelic(); // accepts the same options as connect(), plus eventType (default "ElementTiming")
  ```

  Each event becomes an `ElementTiming` custom event with the attributes `elementName`, `phase`,
  `source`, `time`, `sinceNavigation` and `navigation`, plus the agent's usual page and session
  attributes. The element's name goes in `elementName` because the agent overwrites `name` with its own
  transaction name. This
  uses `newrelic.recordCustomEvent`, so it needs the Pro or Pro+SPA browser agent, v1.277.0 or later.
  With the Lite agent or an older version, nothing is sent. Example query:

  ```sql
  SELECT percentile(sinceNavigation, 50, 75, 95) FROM ElementTiming
  WHERE phase = 'interactive' FACET elementName, source SINCE 1 day ago
  ```

- **Dynatrace (new RUM experience):** call `connectDynatrace()` once on the client:

  ```ts
  import { connectDynatrace } from "next-element-timing/dynatrace";

  connectDynatrace(); // accepts the same options as connect()
  ```

  Each event is sent with `dynatrace.sendEvent` as a custom event. The event spans from the
  navigation that rendered the element to the phase, so `start_time` is the navigation's time and
  `duration` is `sinceNavigation`, rounded to whole milliseconds. **Dynatrace discards event
  properties that aren't on the frontend's allow list**, so add these first. In Experience Vitals, open
  your web frontend, then go to **Settings** → **Capture properties** → **Allowed API-reported
  properties** → **New property**. Enter each key without the `event_properties.` prefix, because
  Dynatrace adds it:

  - `element_timing_name`
  - `element_timing_phase`
  - `element_timing_source`
  - `element_timing_since_navigation`
  - `element_timing_navigation`

  The full keys are also exported as `EVENT_PROPERTIES`. RUM Classic (`dtrum`) isn't supported.

- **API:** `getEvents()`, `subscribe(listener)`, `clearEvents()`, `startNavigation(url)`, `connect(sink, options)` and
  `trackPagesRouter(router)` from `next-element-timing`.

## Caveats

- Background tabs throttle timers (to about 1 s in Chrome) and don't paint, so `react-internals`
  and `paint` times from hidden tabs are inflated.
- Each (element, phase, source) is recorded once. Elements that persist across client
  navigations, such as a header, are not re-recorded.

## Development

```sh
npm run build          # tsc → dist/
npm test               # vitest (jsdom) unit tests in test/
npm run test:coverage  # same, failing below 100% statement/branch/function/line coverage of src/
npm run typecheck      # tsc over src/ and test/ without emitting
npm pack               # cleans, rebuilds and packs dist/ + src/
npm run check:react18  # packs, installs into fixtures/pages-react18 (React 18.3.1) in a temp dir, builds
```

`check:react18` uses a plain `npm install`, so it also catches peer-range regressions. To try the
fixture in a browser, run `KEEP=1 npm run check:react18`, then `npm start` in the directory it prints.

### Live test against New Relic and Dynatrace

`npm run harness` serves `fixtures/vendors-app`, an App Router app that loads your real vendor scripts
and calls `connectNewRelic()` and `connectDynatrace()`. `npm run verify:vendors` then queries each
vendor's API to check that the events arrived. Configuration lives in `.harness/`, which is gitignored:

1. `mkdir .harness && cp scripts/harness.env.example .harness/.env`, then fill it in. You can leave a
   vendor's values empty to skip that vendor.
   - **New Relic:** save the browser app's copy-paste snippet (Pro or Pro+SPA, agent v1.277.0+) as
     `.harness/newrelic-snippet.html`. For querying, set the account id and a user API key (`NRAK-…`).
   - **Dynatrace:** set `DYNATRACE_RUM_SCRIPT_URL` to the JavaScript tag URL of a web frontend that
     uses the new RUM experience, and define the five event properties listed above. For querying, set
     the environment URL (`https://<id>.apps.dynatrace.com`) and a platform token with the
     `storage:user.events:read` scope.
2. Run `npm run harness`. It packs the library, builds the app in a temp dir and starts it on port 3100
   (set `PORT` to change it). It prints a URL containing a run id. Open that URL in Chrome, click the
   button, go to page two and click its button there too. Then keep the tab open for about 30 s,
   because the agents batch their uploads.
3. In another terminal, run `npm run verify:vendors -- <run id>`. It retries for up to 3 minutes
   (`--timeout <seconds>`) while the vendors ingest, then prints the events each vendor received
   (element, phase:source and sinceNavigation). It exits 1 if a configured vendor never got the
   button's `interactive:hook` event.

To test events recorded before the vendor scripts load, run `DELAY_MS=5000 npm run harness`, which
injects the vendor scripts 5 s after hydration. The page shows whether each vendor is ready yet.
