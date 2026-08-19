import re

with open('src/lib/workflow-engine.ts', 'r') as f:
    content = f.read()

content = content.replace(
"""async function executeNode(
  runId: string | undefined,
  node: Node<VeniceNodeData>,
  input: string,
  signal?: AbortSignal,
): Promise<string> {""",
"""async function executeNode(
  runId: string | undefined,
  node: Node<VeniceNodeData>,
  input: string,
  signal?: AbortSignal,
): Promise<string> {"""
)

# wait I already replaced it with sed earlier! Let's check!
