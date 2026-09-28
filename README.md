# next-element-timing

Measure when specific elements in a Next.js app **appear**, **paint**, and become **interactive**,
meaning React has hydrated them and their event handlers will respond. Send the timings to New Relic,
Dynatrace or your own analytics.

This guide is for **Next.js 16.3+ with the App Router**. Using the Pages Router, or an older Next.js?
See [Pages Router](./PAGES_ROUTER.md) or [Older Next.js and React versions](./OLDER_VERSIONS.md).

## Quick start

```sh
npm install next-element-timing
```

**1. Load the client module before hydration** by wrapping your Next.js config:

```ts
// next.config.ts
import { withElementTiming } from "next-element-timing/next";

export default withElementTiming({
  /* your config */
});
```

Client-side navigations are tracked automatically, so each page's timings start from the navigation that
rendered it.

**2. Tag the elements you want to time.** In client components, spread `timingProps`:

```tsx
"use client";
import { timingProps } from "next-element-timing";

<button {...timingProps("add-to-bag")} onClick={add}>Add to bag</button>
```

In server components you can't pass a ref, so add the two attributes directly:

```tsx
<Link href="/" data-timing="logo" elementtiming="logo">Home</Link>
```

**3. See the timings.** Add the overlay to your root layout while you're developing (disable in production):

```tsx
// app/layout.tsx
import { TimingPanel } from "next-element-timing/panel";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <TimingPanel />
      </body>
    </html>
  );
}
```

Load a page and the panel lists each tagged element with its Present, Paint and Live times in
milliseconds since the navigation.

## Send timings to your monitoring tool

Each of these is independent; follow only the one you use:

- **[New Relic](./NEW_RELIC_INTEGRATION.md)**: one line, using the browser agent you already have.
- **[Dynatrace](./DYNATRACE_INTEGRATION.md)**: allow-list six properties, then one line.
- **[Anything else](./CUSTOM_INTEGRATION.md)**: your own analytics endpoint or another tool.

## What gets measured

| Phase         | Source            | How it's measured                                                                   |
| ------------- | ----------------- | ----------------------------------------------------------------------------------- |
| `present`     | `dom`             | When the element is in the DOM. For server-rendered HTML, when the client module ran (an upper bound). |
| `paint`       | `element-timing`  | When the browser painted it, from the [Element Timing API](https://developer.mozilla.org/docs/Web/API/PerformanceElementTiming). Chromium only; needs the `elementtiming` attribute. |
| `interactive` | `hook`            | When the `timingProps` ref fires, in React's commit phase. Uses only supported React APIs. |
| `interactive` | `react-internals` | Polls every 16 ms for an `on*` handler in React's private props. Works without `timingProps`, but **relies on React internals and may break on upgrade**. |

Every event has `sinceNavigation`: milliseconds since the initial page load or the client-side
navigation that rendered the element.

## Caveats

- Background tabs throttle timers (to about 1 s in Chrome) and don't paint, so `react-internals`
  and `paint` times from hidden tabs are inflated.
- Each (element, phase, source) is recorded once. Elements that persist across client
  navigations, such as a header, are not re-recorded.
- Monitoring tools stamp events when they receive them, which can be later than they happened. See
  [Timestamps](./TIMESTAMPS.md).

## More

- [Pages Router](./PAGES_ROUTER.md) and [older Next.js and React versions](./OLDER_VERSIONS.md)
- [Custom integrations and the full API](./CUSTOM_INTEGRATION.md)
- [Timestamps in monitoring tools](./TIMESTAMPS.md)
- [Contributing: building, testing and the live vendor harness](./CONTRIBUTING.md)
