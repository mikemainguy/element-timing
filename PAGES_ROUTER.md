# Pages Router (React 18 or 19)

Setup for apps using the Pages Router (`pages/`) on **Next.js 16.3+**. It differs from the
[App Router quick start](./README.md#quick-start) in one step: you pass the router to
`trackPagesRouter`. On an older Next.js, see [Older Next.js and React versions](./OLDER_VERSIONS.md).

The Pages Router uses the React version in your `package.json`, and React 18 and 19 both work. Tested
with React 18.3.1 on Next.js 16.3.6.

**1. Load the client module before hydration**, as in the App Router:

```ts
// next.config.ts
import { withElementTiming } from "next-element-timing/next";

export default withElementTiming({
  /* your config */
});
```

**2. Track navigations.** The Pages Router doesn't tell the client module about client-side
navigations, so without this step every time is measured from the first page load. Pass the router to
`trackPagesRouter` in `pages/_app.tsx`. This is also a good place for the overlay:

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

`trackPagesRouter` takes the router as an argument instead of importing `next/router`, so App Router
apps never bundle it.

**3. Tag elements.** In the Pages Router every component is a client component, so you can use
`timingProps` anywhere. Plain attributes work too:

```tsx
import Link from "next/link";
import { timingProps } from "next-element-timing";

<button {...timingProps("counter")} onClick={increment}>Add</button>
<Link href="/two" data-timing="to-two" elementtiming="to-two">Page two</Link>
```

**Sending to a monitoring tool** works the same as with the App Router. Follow the
[New Relic](./NEW_RELIC_INTEGRATION.md), [Dynatrace](./DYNATRACE_INTEGRATION.md) or
[custom](./CUSTOM_INTEGRATION.md) guide; `instrumentation-client.ts` runs for the Pages Router too.
