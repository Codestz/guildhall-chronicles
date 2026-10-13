#!/usr/bin/env bash
# Publishes what a build left in OUT (OUT/chronicles/*.json.gz, OUT/og/*.png) to main: on the latest
# main, copy them in, rebuild index.json (stamped with the builder), the README's catalog table and
# site/, commit, push. Builds run in parallel (one per issue), so a push that loses the race starts again from the new main; generated files are never
# merged, only rebuilt.
#
#   scripts/publish.sh <OUT> <commit message>
set -euo pipefail
out="$1"
message="$2"

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

for attempt in 1 2 3 4 5; do
  git fetch --quiet origin main
  git reset --quiet --hard origin/main
  cp -R "$out"/. .
  bun builder/chronicle.js index chronicles --out index.json
  bun scripts/catalog.ts
  bun scripts/site.ts
  git add chronicles og index.json README.md site
  if git diff --cached --quiet; then
    echo "nothing new to publish"
    exit 0
  fi
  git commit --quiet -m "$message"
  if git push --quiet origin HEAD:main; then
    git log -1 --format='published %h %s'
    exit 0
  fi
  echo "main moved on; trying again ($attempt)"
  sleep $((attempt * 5))
done
echo "couldn't publish after 5 tries" >&2
exit 1
