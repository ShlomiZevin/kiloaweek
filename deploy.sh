#!/usr/bin/env bash
# bash deploy.sh          -> typecheck, build, hosting + Firestore rules on kiloaweek-app
# bash deploy.sh server   -> the functions (kawApi, kawReminders) on boostmind-b052c, codebase "kiloaweek" only
set -euo pipefail
cd "$(dirname "$0")"
if [ "${1:-}" = "server" ]; then
  node --check functions/index.js
  firebase deploy --only functions:kiloaweek --project boostmind-b052c --force
else
  npx tsc -b
  npx vite build
  firebase deploy --only hosting,firestore:rules --project kiloaweek-app
fi
