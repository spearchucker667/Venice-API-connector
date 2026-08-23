### VF-P1-004 Character scene references
Add tests to `src/utils/payloadBuilders.modelAware.test.ts` for `style_references` to ensure it drops references when:
- model supports reference images = false
- model missing metadata
- model removed from catalog (not recognized)
- reference strength limits exceeded (clamp them or drop them depending on logic)
