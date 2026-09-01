#!/bin/bash
# Enforce GitHub branch protection rules on main using the GitHub CLI (gh)
# Mandates the CI and CodeQL status checks on main, requires 1 approving review, etc.

JSON_PAYLOAD=$(cat <<JSON
{
  "name": "Protect Main Enforced",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": {
      "include": ["refs/heads/main"],
      "exclude": []
    }
  },
  "rules": [
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 1,
        "require_code_owner_review": true,
        "require_last_push_approval": true,
        "dismiss_stale_reviews_on_push": true
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "required_status_checks": [
          { "context": "lint-and-typecheck" },
          { "context": "unit-and-integration-tests" },
          { "context": "coverage" },
          { "context": "script-coverage" },
          { "context": "contracts" },
          { "context": "build" },
          { "context": "windows-sensitive-tests" },
          { "context": "macos-sensitive-tests" },
          { "context": "electron-smoke-macos" },
          { "context": "electron-smoke-windows" },
          { "context": "electron-smoke-linux" },
          { "context": "CodeQL / javascript-typescript" },
          { "context": "CodeQL / actions" }
        ]
      }
    }
  ]
}
JSON
)

echo "Pushing ruleset to GitHub..."
echo "$JSON_PAYLOAD" | gh api \
  --method POST \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  /repos/{owner}/{repo}/rulesets \
  --input -

echo "Successfully enforced GitHub ruleset on main branch."
