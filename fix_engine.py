import re

with open('src/lib/workflow-engine.ts', 'r') as f:
    content = f.read()

content = content.replace(
    'request: requestSummary,',
    'request: requestSummary,\n        runId: runId,\n        nodeId: node.id,'
)

with open('src/lib/workflow-engine.ts', 'w') as f:
    f.write(content)
