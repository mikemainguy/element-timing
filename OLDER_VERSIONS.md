# Older Next.js and React versions

The [quick start](./README.md#quick-start) assumes Next.js 16.3+. This page covers what changes on
older versions.

## Which React version am I on?

The App Router always runs Next.js's built-in React (19.x), whatever React your `package.json` lists.
Only the Pages Router uses your installed React.

| Your app                           | React used | Follow                                        |
| ---------------------------------- | ---------- | --------------------------------------------- |
| App Router (`app/`)                | 19         | [Quick start](./README.md#quick-start)        |
| Pages Router (`pages/`), React 19  | 19         | [Pages Router](./PAGES_ROUTER.md)             |
| Pages Router (`pages/`), React 18  | 18         | [Pages Router](./PAGES_ROUTER.md)             |

React 18 and 19 both work because they attach refs the same way and store event handlers under the same
`__reactProps$` key. React 17 and earlier are not supported.

## Next.js 15.3 – 16.2

These versions have `instrumentation-client.ts` but not the `instrumentationClientInject` option that
`withElementTiming` uses. Skip `withElementTiming` and re-export the client module from your own
`instrumentation-client.ts` instead. Put any monitoring-tool connection in the same file:

```ts
// instrumentation-client.ts
export * from "next-element-timing/client";

// Optional, for example:
// import { connectNewRelic } from "next-element-timing/newrelic";
// connectNewRelic();
```

Everything else is the same as the [App Router quick start](./README.md#quick-start) or the
[Pages Router](./PAGES_ROUTER.md) setup.

## Next.js 13 – 15.2 (untested)

These versions have no `instrumentation-client.ts`, and they're below the package's supported range
(`next >= 15.3`), so they're untested.

With the **Pages Router**, import the client module for its side effects as the **first line** of
`pages/_app.tsx`, so it runs before hydration, and keep the `trackPagesRouter` call from the
[Pages Router](./PAGES_ROUTER.md) setup. Connect to a monitoring tool in the same file:

```tsx
// pages/_app.tsx
import "next-element-timing/client";
import Router from "next/router";
import { trackPagesRouter } from "next-element-timing";

trackPagesRouter(Router);
```

The **App Router** on these versions isn't supported: they have no way to run the client module before
hydration.
