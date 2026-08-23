### CI/CD Pipeline
Update `.github/workflows/ci.yml` to include:
1. `npm run verify:i18n` and `npm run verify:i18n-hardcoded-regressions` in the `contracts` job.
2. Replace `npm run verify:contracts` with `npm run verify:full-contract-suite` which runs the full suite (also add this script to `package.json` if missing).
3. Add `verify:release-metadata` and `verify:release-packaging-hardening` to the `build` or `contracts` jobs.
4. Add `actions/upload-artifact` step with `if: failure()` to upload `test-results`, `coverage`, and `dist` for the `unit-and-integration-tests` and `electron-smoke-*` jobs.
