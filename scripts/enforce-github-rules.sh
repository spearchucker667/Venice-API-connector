#!/usr/bin/env bash
# enforce-github-rules.sh — idempotently update live GitHub Rules01 required
# status checks to match the current CI matrix.
#
# Usage:
#   scripts/enforce-github-rules.sh        # apply the update
#   scripts/enforce-github-rules.sh --dry-run  # print payload and exit
#
# Requires: gh CLI authenticated with repo scope, jq.
# Preserves: bypass_actors (admin bypass is intentionally untouched).

set -euo pipefail

RULESET_ID="21229461"
DRY_RUN=false

if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "ERROR: gh CLI is required. Install it and run 'gh auth login'." >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq is required." >&2
  exit 1
fi

echo "Fetching live ruleset ${RULESET_ID}..."
RAW=$(gh api --method GET \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "/repos/{owner}/{repo}/rulesets/${RULESET_ID}") || {
  echo "ERROR: Failed to fetch live ruleset. Are you authenticated with 'gh auth login'?" >&2
  exit 1
}

REQUIRED_CHECKS_JSON=$(jq -n '
  [
    "lint-and-typecheck",
    "unit-and-integration-tests",
    "coverage",
    "script-coverage",
    "contracts",
    "build",
    "windows-sensitive-tests",
    "macos-sensitive-tests",
    "electron-smoke-macos",
    "electron-smoke-windows",
    "electron-smoke-linux",
    "Analyze javascript-typescript",
    "Analyze actions"
  ] | map({ context: . })
')

# Build the updated payload preserving every field except the required_status_checks
# parameter inside the required_status_checks rule.
PAYLOAD=$(echo "${RAW}" | jq --argjson checks "${REQUIRED_CHECKS_JSON}" '
  .rules |= map(
    if .type == "required_status_checks" then
      .parameters.strict_required_status_checks_policy = true
      | .parameters.required_status_checks = $checks
    else
      .
    end
  )
  | { name: .name, target: .target, enforcement: .enforcement, bypass_actors: .bypass_actors, conditions: .conditions, rules: .rules }
')

if [[ "$DRY_RUN" == "true" ]]; then
  echo "Dry run. Payload that would be sent:"
  echo "$PAYLOAD" | jq .
  exit 0
fi

PAYLOAD_FILE=$(mktemp)
trap 'rm -f "$PAYLOAD_FILE"' EXIT

echo "$PAYLOAD" > "$PAYLOAD_FILE"

echo "Updating ruleset ${RULESET_ID}..."
gh api --method PUT \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "/repos/{owner}/{repo}/rulesets/${RULESET_ID}" \
  --input "$PAYLOAD_FILE"

echo "Successfully enforced GitHub ruleset ${RULESET_ID} on main branch."
