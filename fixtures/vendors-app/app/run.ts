// Every element name starts with `harness-<run>-` so scripts/verify-vendor-events.mjs can find
// this run's events in each vendor.

export type RunSearchParams = Promise<{ run?: string }>;

export async function runOf(searchParams: RunSearchParams) {
  const run = (await searchParams).run ?? process.env.HARNESS_RUN ?? "manual";
  return { run, prefix: `harness-${run}-` };
}
