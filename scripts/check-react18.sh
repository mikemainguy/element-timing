#!/usr/bin/env bash
# Packs this package and builds the React 18 Pages Router fixture against it in a temp dir,
# with a plain `npm install` (no --legacy-peer-deps) so peer ranges are checked too.
#
#   npm run check:react18            # install + typecheck + build
#   KEEP=1 npm run check:react18     # keep the temp app; then `npm start` in it to try the panel
set -euo pipefail

pkg_dir="$(cd "$(dirname "$0")/.." && pwd)"
work="$(mktemp -d)"
[[ "${KEEP:-}" == 1 ]] || trap 'rm -rf "$work"' EXIT

tarball="$(cd "$pkg_dir" && npm pack --silent --pack-destination "$work")"
cp -R "$pkg_dir/fixtures/pages-react18" "$work/app"
cd "$work/app"

npm install --no-audit --no-fund "$work/$tarball"
node -e 'const v = require("react/package.json").version; if (!v.startsWith("18.")) throw new Error(`expected React 18, got ${v}`); console.log(`react ${v}`)'
npx next build

echo "React 18 fixture built OK${KEEP:+ in $work/app}"
