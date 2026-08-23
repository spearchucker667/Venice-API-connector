### VF-P1-005 Centralize tool capability gating

1. Create `resolveAvailableTools` in `src/agent/registry/tool-registry.ts` (or `src/shared/toolCapabilities.ts`). It should take `modelInfo`, `veniceParams` (specifically if document tools are enabled), and `hasWorkspaceGrant` (boolean), and return `ProviderToolSchema[]`.
2. Ensure it strictly checks `supportsFunctionCalling(modelInfo)`. If false, return `[]`.
3. In `src/stores/chat-stream-manager.ts`, replace the inline tool filtering with a call to `resolveAvailableTools`.
4. This ensures a single authoritative choke point for injecting tools into the request body.
