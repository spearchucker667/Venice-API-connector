import re
from datetime import datetime

with open('docs/summary_of_work.md', 'r') as f:
    content = f.read()

# Append session history
today = datetime.now().strftime('%Y-%m-%d')
session_history_entry = f"- **{today} — Workflow Output Idempotency (P1-006) Remediation:** Fixed duplicate output generation in workflow engine. Added `runId` and `nodeId` propagation to `executeNode` and `awaitWorkflowVideoTask`, ensuring that output-node media generation is keyed by `${{runId}}-${{nodeId}}`. This guarantees per-run output-node generation idempotency as requested by P1-006. Validated with `npm run typecheck`, `npm run test:ci`, and `npm run verify:contracts`.\n"

# We'll just append it to the top of the history list.
content = content.replace('- **2026-07-15', session_history_entry + '- **2026-07-15')

with open('docs/summary_of_work.md', 'w') as f:
    f.write(content)
