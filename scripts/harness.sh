#!/usr/bin/env bash
# Builds fixtures/vendors-app against a packed copy of this package, in a temp dir, and serves it
# with your real New Relic and Dynatrace browser configuration from .harness/ (see
# scripts/harness.env.example). Open the printed URL in Chrome, then check the events arrived with
# `npm run verify:vendors -- <run>`.
#
#   npm run harness                 # vendor scripts in <head>, as most apps load them
#   DELAY_MS=5000 npm run harness   # vendor scripts load 5 s after hydration (tests replay)
#   PORT=3200 RUN=my-run npm run harness
set -euo pipefail

pkg_dir="$(cd "$(dirname "$0")/.." && pwd)"
config="$pkg_dir/.harness"
if [[ ! -f "$config/.env" ]]; then
  echo "Missing $config/.env: copy scripts/harness.env.example there and fill it in." >&2
  exit 1
fi
set -a
# shellcheck disable=SC1091
source "$config/.env"
set +a

snippet="$config/newrelic-snippet.html"
[[ -f "$snippet" ]] && export HARNESS_NEW_RELIC_SNIPPET="$snippet"
if [[ -z "${HARNESS_NEW_RELIC_SNIPPET:-}" && -z "${DYNATRACE_RUM_SCRIPT_URL:-}" ]]; then
  echo "Neither $snippet nor DYNATRACE_RUM_SCRIPT_URL is set, so nothing would be sent." >&2
  exit 1
fi

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

tarball="$(cd "$pkg_dir" && npm pack --silent --pack-destination "$work")"
cp -R "$pkg_dir/fixtures/vendors-app" "$work/app"
cd "$work/app"
npm install --no-audit --no-fund "$work/$tarball"
npx next build

port="${PORT:-3100}"
export HARNESS_RUN="${RUN:-$(date +%Y%m%d-%H%M%S)}"
export HARNESS_DELAY_MS="${DELAY_MS:-0}"

cat <<EOF

Harness run $HARNESS_RUN
  New Relic: ${HARNESS_NEW_RELIC_SNIPPET:+configured}${HARNESS_NEW_RELIC_SNIPPET:-not configured}
  Dynatrace: ${DYNATRACE_RUM_SCRIPT_URL:+configured}${DYNATRACE_RUM_SCRIPT_URL:-not configured}
  Vendor scripts: $([[ "$HARNESS_DELAY_MS" == 0 ]] && echo "in <head>" || echo "delayed $HARNESS_DELAY_MS ms")

1. Open http://localhost:$port/?run=$HARNESS_RUN in Chrome, click the button, go to page two and
   click its button. Keep the tab in the foreground for ~30 s so the vendors' agents send.
2. In another terminal: npm run verify:vendors -- $HARNESS_RUN

EOF
npx next start -p "$port"
