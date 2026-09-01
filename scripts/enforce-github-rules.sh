#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');

function run() {
  const RULESET_ID = 21229461;
  let raw;
  try {
    console.log(`Fetching live ruleset ${RULESET_ID}...`);
    raw = execSync(`gh api --method GET -H "Accept: application/vnd.github+json" -H "X-GitHub-Api-Version: 2022-11-28" /repos/{owner}/{repo}/rulesets/${RULESET_ID}`).toString();
  } catch (err) {
    console.error("Failed to fetch live ruleset. Are you authenticated with 'gh auth login'?");
    process.exit(1);
  }

  const state = JSON.parse(raw);
  
  const checksRule = state.rules.find(r => r.type === "required_status_checks");
  if (checksRule) {
    checksRule.parameters.required_status_checks = [
      { context: "lint-and-typecheck" },
      { context: "unit-and-integration-tests" },
      { context: "coverage" },
      { context: "script-coverage" },
      { context: "contracts" },
      { context: "build" },
      { context: "windows-sensitive-tests" },
      { context: "macos-sensitive-tests" },
      { context: "electron-smoke-macos" },
      { context: "electron-smoke-windows" },
      { context: "electron-smoke-linux" },
      { context: "Analyze javascript-typescript" },
      { context: "Analyze actions" }
    ];
  } else {
    state.rules.push({
      type: "required_status_checks",
      parameters: {
        strict_required_status_checks_policy: true,
        required_status_checks: [
          { context: "lint-and-typecheck" },
          { context: "unit-and-integration-tests" },
          { context: "coverage" },
          { context: "script-coverage" },
          { context: "contracts" },
          { context: "build" },
          { context: "windows-sensitive-tests" },
          { context: "macos-sensitive-tests" },
          { context: "electron-smoke-macos" },
          { context: "electron-smoke-windows" },
          { context: "electron-smoke-linux" },
          { context: "Analyze javascript-typescript" },
          { context: "Analyze actions" }
        ]
      }
    });
  }

  const payload = {
    name: state.name,
    target: state.target,
    enforcement: state.enforcement,
    bypass_actors: state.bypass_actors,
    conditions: state.conditions,
    rules: state.rules
  };

  fs.writeFileSync('ruleset_payload.json', JSON.stringify(payload, null, 2));
  
  if (process.argv.includes('--dry-run')) {
    console.log("Dry run. Payload would be:");
    console.log(fs.readFileSync('ruleset_payload.json', 'utf8'));
  } else {
    console.log("Updating ruleset...");
    try {
      execSync(`gh api --method PUT -H "Accept: application/vnd.github+json" -H "X-GitHub-Api-Version: 2022-11-28" /repos/{owner}/{repo}/rulesets/${RULESET_ID} --input ruleset_payload.json`, { stdio: 'inherit' });
      console.log("Successfully enforced GitHub ruleset on main branch.");
    } catch (err) {
      console.error("Failed to update ruleset.");
      process.exit(1);
    }
  }
  
  fs.unlinkSync('ruleset_payload.json');
}

run();
