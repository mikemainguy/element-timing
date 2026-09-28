# Contributing

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

## Live test against New Relic and Dynatrace

`npm run harness` serves `fixtures/vendors-app`, an App Router app that loads your real vendor scripts
and calls `connectNewRelic()` and `connectDynatrace()`. `npm run verify:vendors` then queries each
vendor's API to check that the events arrived. Configuration lives in `.harness/`, which is gitignored:

1. `mkdir .harness && cp scripts/harness.env.example .harness/.env`, then fill it in. You can leave a
   vendor's values empty to skip that vendor.
   - **New Relic:** save the browser app's copy-paste snippet (Pro or Pro+SPA, agent v1.277.0+) as
     `.harness/newrelic-snippet.html`. For querying, set the account id and a user API key (`NRAK-…`).
   - **Dynatrace:** set `DYNATRACE_RUM_SCRIPT_URL` to the JavaScript tag URL of a web frontend that
     uses the new RUM experience, and allow-list the six properties from
     [the Dynatrace guide](./DYNATRACE_INTEGRATION.md#1-allow-the-event-properties). For querying, set
     the environment URL (`https://<id>.apps.dynatrace.com`) and a platform token with the
     `storage:user.events:read` scope.
2. Run `npm run harness`. It packs the library, builds the app in a temp dir and starts it on port 3100
   (set `PORT` to change it). It prints a URL containing a run id. Open that URL in Chrome, click the
   button, go to page two and click its button there too. Then keep the tab open for about 30 s,
   because the agents batch their uploads.
3. In another terminal, run `npm run verify:vendors -- <run id>`. It retries for up to 3 minutes
   (`--timeout <seconds>`) while the vendors ingest, then prints the events each vendor received
   (count and sinceNavigation range per element and phase:source) and each vendor's send-delay range.
   It exits 1 if a configured vendor never got the button's `interactive:hook` event.

To test events recorded before the vendor scripts load, run `DELAY_MS=5000 npm run harness`, which
injects the vendor scripts 5 s after hydration. The page shows whether each vendor is ready yet.
