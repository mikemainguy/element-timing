# Timestamps in monitoring tools

**Short version:** New Relic and Dynatrace stamp our events with the time they were *sent*, which can be
seconds after they *happened*. Each event carries its send delay, so you can recover the real time:

| Tool      | When it happened                          |
| --------- | ----------------------------------------- |
| New Relic | `timestamp - sendDelay`                   |
| Dynatrace | `end_time - element_timing_send_delay`    |

Durations such as `sinceNavigation` are measured in the browser and are always correct. Only an event's
position on the tool's timeline is affected.

## Why events are sent late

The client module records events from before hydration, usually before a monitoring script has loaded.
`connect()` holds them and sends them once the script is ready. With the script in `<head>`, the gap is a
few milliseconds. When the script loads late, it can be seconds: about 6 s in our test, where the scripts
loaded 5 s after hydration.

## Why the tools don't use the real time

Neither tool lets a page set when a custom event happened:

- **New Relic** sets `timestamp` when `recordCustomEvent` is called; the call has no timestamp argument.
- **Dynatrace** ignores a `start_time` passed to `sendEvent`. It stores `end_time` as the send time and
  `start_time` as `end_time - duration`.

The tools' own data is mostly placed when it happened: Dynatrace's navigations, and New Relic's
`BrowserPerformance` events captured from `performance.measure`. New Relic's `PageView`, though, is stamped
when its agent starts.

## Why a delay, not a clock time

Both tools correct browser timestamps to their own server clock, because users' clocks can be wrong: by
238 ms in our test, and by minutes on a badly set machine. A clock time from the browser would skip that
correction. A delay doesn't need it: subtracting it from the tool's corrected timestamp gives a corrected
time. In our test, working back from our Dynatrace events gave exactly the page's navigation start as
recorded by Dynatrace itself.

If you write your own sink, include the delay the same way; see
[Custom integrations](./CUSTOM_INTEGRATION.md#sinks-recommended).

## Sources

- [New Relic recordCustomEvent](https://docs.newrelic.com/docs/browser/new-relic-browser/browser-apis/recordcustomevent/)
- [New Relic browser custom events](https://docs.newrelic.com/docs/data-apis/custom-data/custom-events/report-browser-monitoring-custom-events-attributes/)
- [New Relic agent server-time correction](https://github.com/newrelic/newrelic-browser-agent/pull/1867)
- [New Relic agent v1.255.0 release notes](https://docs.newrelic.com/docs/release-notes/new-relic-browser-release-notes/browser-agent-release-notes/browser-agent-v1.255.0/)
- [Dynatrace user events: time correction, start_time and end_time](https://docs.dynatrace.com/docs/discover-dynatrace/references/semantic-dictionary/model/rum/user-events)
- [Dynatrace event and session properties](https://docs.dynatrace.com/docs/observe/digital-experience/new-rum-experience/web-frontends/additional-configuration/event-and-session-properties)

The send-time behaviour was measured with the [live vendor harness](./CONTRIBUTING.md#live-test-against-new-relic-and-dynatrace)
on 2026-09-28, with New Relic browser agent 1.322.0 and Dynatrace RUM JavaScript 1.345.3.
