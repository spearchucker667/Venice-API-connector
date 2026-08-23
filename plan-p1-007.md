### VF-P1-007 Strengthen stream retry state tracking

Update `src/stores/chat-stream-manager.ts`
1. Replace `hasReceivedOutput` with `hasCommittedStreamState`.
2. In `onDelta`:
```typescript
          onDelta: (chunk) => {
            if (
              (chunk.content && chunk.content.length > 0) ||
              (chunk.reasoning && chunk.reasoning.length > 0) ||
              (chunk.tool_calls && chunk.tool_calls.length > 0) ||
              (chunk.appendedMessages && chunk.appendedMessages.length > 0) ||
              chunk.usage
            ) {
              hasCommittedStreamState = true;
            }
            bufferStreamDelta(convId, chunk);
          }
```
3. Update the retry check: `!hasCommittedStreamState`.
