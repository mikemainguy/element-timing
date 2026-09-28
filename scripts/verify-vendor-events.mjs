// Checks that a harness run's element timing events reached New Relic and Dynatrace, by querying
// each vendor's API for events whose name starts with `harness-<run>-`.
//
//   npm run verify:vendors -- <run> [--timeout 300]
//
// Reads credentials from .harness/.env (see scripts/harness.env.example). A vendor without query
// credentials is skipped. Ingest takes a minute or two, so this retries until every configured
// vendor has the home page button's interactive:hook event, or the timeout (seconds) passes.
// Exits 1 if any configured vendor is still missing it.

const args = process.argv.slice(2);
const run = args.find((a) => !a.startsWith("--"));
const timeoutIndex = args.indexOf("--timeout");
const timeoutS = timeoutIndex >= 0 ? Number(args[timeoutIndex + 1]) : 180;
const POLL_S = 20;

if (!run || !/^[\w-]+$/.test(run)) {
  console.error("Usage: npm run verify:vendors -- <run> [--timeout seconds]");
  process.exit(2);
}
const prefix = `harness-${run}-`;
const required = { name: `${prefix}button`, phase: "interactive", source: "hook" };

const env = process.env;

async function queryNewRelic() {
  const region = env.NEW_RELIC_REGION === "eu" ? "api.eu.newrelic.com" : "api.newrelic.com";
  const nrql =
    `SELECT elementName AS name, phase, source, sinceNavigation, navigation, sendDelay FROM ElementTiming ` +
    `WHERE elementName LIKE '${prefix}%' SINCE 1 day ago LIMIT MAX`;
  const response = await fetch(`https://${region}/graphql`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "API-Key": env.NEW_RELIC_USER_API_KEY },
    body: JSON.stringify({
      query: "query($id: Int!, $nrql: Nrql!) { actor { account(id: $id) { nrql(query: $nrql) { results } } } }",
      variables: { id: Number(env.NEW_RELIC_ACCOUNT_ID), nrql },
    }),
  });
  const body = await response.json();
  if (!response.ok || body.errors?.length) {
    throw new Error(`New Relic ${response.status}: ${JSON.stringify(body.errors ?? body)}`);
  }
  return body.data.actor.account.nrql.results;
}

async function dql(query) {
  const base = env.DYNATRACE_ENVIRONMENT_URL.replace(/\/+$/, "");
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${env.DYNATRACE_PLATFORM_TOKEN}` };
  let response = await fetch(`${base}/platform/storage/query/v1/query:execute`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, requestTimeoutMilliseconds: 30_000 }),
  });
  let body = await response.json();
  while (response.ok && body.state !== "SUCCEEDED" && body.requestToken) {
    const token = encodeURIComponent(body.requestToken);
    response = await fetch(`${base}/platform/storage/query/v1/query:poll?request-token=${token}`, { headers });
    body = await response.json();
  }
  if (!response.ok || body.state !== "SUCCEEDED") {
    throw new Error(`Dynatrace ${response.status}: ${JSON.stringify(body.error ?? body)}`);
  }
  return body.result.records;
}

async function queryDynatrace() {
  const records = await dql(
    [
      "fetch user.events, from: -24h",
      `| filter startsWith(event_properties.element_timing_name, "${prefix}")`,
      "| fields start_time, duration,",
      "    name = event_properties.element_timing_name,",
      "    phase = event_properties.element_timing_phase,",
      "    source = event_properties.element_timing_source,",
      "    sinceNavigation = event_properties.element_timing_since_navigation,",
      "    navigation = event_properties.element_timing_navigation,",
      "    sendDelay = event_properties.element_timing_send_delay",
    ].join("\n"),
  );
  if (records.length > 0) return records;

  // The RUM JavaScript strips properties that aren't on the frontend's allow list but still sends
  // the event, recording what it dropped. Say so, rather than reporting "no events".
  const [dropped] = await dql(
    [
      "fetch user.events, from: -24h",
      `| filter characteristics.is_api_reported == true and contains(page.url.full, "run=${run}")`,
      "| filter isNotNull(dt.support.dropped_custom_properties)",
      "| summarize n = count()",
    ].join("\n"),
  );
  if (Number(dropped?.n) > 0) {
    throw new Error(
      `Dynatrace received ${dropped.n} events for this run but dropped their event_properties.element_timing_* ` +
        "properties: they're not on the frontend's allow list (Settings → Capture properties → Allowed " +
        "API-reported properties), or the allow list changed less than a few minutes before the run.",
    );
  }
  return records;
}

const vendors = [
  { name: "New Relic", configured: env.NEW_RELIC_ACCOUNT_ID && env.NEW_RELIC_USER_API_KEY, query: queryNewRelic },
  { name: "Dynatrace", configured: env.DYNATRACE_ENVIRONMENT_URL && env.DYNATRACE_PLATFORM_TOKEN, query: queryDynatrace },
].filter((vendor) => {
  if (!vendor.configured) console.log(`${vendor.name}: skipped (no query credentials in .harness/.env)`);
  return vendor.configured;
});
if (vendors.length === 0) {
  console.error("No vendor has query credentials; see scripts/harness.env.example.");
  process.exit(2);
}

const hasRequired = (events) =>
  events.some((e) => e.name === required.name && e.phase === required.phase && e.source === required.source);

const results = new Map();

async function queryAll(onlyWaiting) {
  for (const vendor of vendors) {
    if (onlyWaiting && hasRequired(results.get(vendor.name) ?? [])) continue;
    try {
      results.set(vendor.name, await vendor.query());
    } catch (error) {
      console.error(String(error.message ?? error));
      results.set(vendor.name, []);
    }
  }
}

const deadline = Date.now() + timeoutS * 1000;
let queriedAllLast = true;
for (;;) {
  const waiting = vendors.filter((v) => !hasRequired(results.get(v.name) ?? []));
  queriedAllLast = waiting.length === vendors.length;
  await queryAll(true);
  const stillWaiting = vendors.filter((v) => !hasRequired(results.get(v.name)));
  if (stillWaiting.length === 0 || Date.now() >= deadline) break;
  console.log(`Waiting for ${stillWaiting.map((v) => v.name).join(" and ")}… (retrying in ${POLL_S} s)`);
  await new Promise((resolve) => setTimeout(resolve, POLL_S * 1000));
}
// Vendors that passed early stopped being queried, but their agents upload in batches (New Relic
// every 30 s), so later events may have arrived since. Refresh them for the report.
if (!queriedAllLast) await queryAll(false);

// One row per element/phase/source, one column per vendor. A run can span several page loads
// (reloads, revisits), so each cell shows how many events arrived and their sinceNavigation range.
const rows = new Map();
for (const vendor of vendors) {
  for (const e of results.get(vendor.name)) {
    const key = `${e.name.slice(prefix.length)}  ${e.phase}:${e.source}`;
    const row = rows.get(key) ?? {};
    (row[vendor.name] ??= []).push(Math.round(Number(e.sinceNavigation)));
    rows.set(key, row);
  }
}
function cell(times) {
  if (!times) return "—";
  const min = Math.min(...times);
  const max = Math.max(...times);
  return times.length === 1 ? `${min} ms` : `${times.length}× ${min}–${max} ms`;
}
console.log(`\nEvents for run ${run} (count × sinceNavigation range, per vendor):`);
console.table(
  Object.fromEntries(
    [...rows]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, row]) => [key, Object.fromEntries(vendors.map((v) => [v.name, cell(row[v.name])]))]),
  ),
);
console.log("A '—' can mean the events are still in a vendor's upload queue; rerun in a minute to check.");

// Vendors timestamp events when they're sent; sendDelay says how late that was (see README "Timestamps").
for (const vendor of vendors) {
  const delays = results
    .get(vendor.name)
    .map((e) => e.sendDelay)
    .filter((d) => d !== null && d !== undefined)
    .map(Number);
  const count = results.get(vendor.name).length;
  if (count === 0) continue;
  if (delays.length === 0) {
    console.log(`${vendor.name}: no sendDelay on its events (older build, or not allow-listed in Dynatrace)`);
  } else {
    console.log(`${vendor.name}: sendDelay ${Math.min(...delays)}–${Math.max(...delays)} ms (${delays.length}/${count} events)`);
  }
}

let failed = false;
for (const vendor of vendors) {
  const ok = hasRequired(results.get(vendor.name));
  failed ||= !ok;
  console.log(`${ok ? "PASS" : "FAIL"} ${vendor.name}: ${results.get(vendor.name).length} events` +
    (ok ? "" : ` — missing ${required.name} ${required.phase}:${required.source}`));
}
process.exit(failed ? 1 : 0);
