# How to Change the Knowledge Item Workflow

## Preconditions
- You know whether the change touches generation, expansion, follow-up, condense, rendering, or persistence.
- You have read:
  [architecture/generation-and-expansion-flow.md](/Users/mac/VAST/知识系统/knowledge-system/llmdoc/architecture/generation-and-expansion-flow.md),
  [architecture/persistence-and-data-model.md](/Users/mac/VAST/知识系统/knowledge-system/llmdoc/architecture/persistence-and-data-model.md),
  and [reference/data-model.md](/Users/mac/VAST/知识系统/knowledge-system/llmdoc/reference/data-model.md).

## Main Steps
1. Update the prompt contract in `src/lib/prompts.ts` if the AI output shape changes.
2. Update TypeScript shapes in `src/types/knowledge.ts` if the stored or rendered content changes.
3. Update parsing in `src/lib/parseKnowledge.ts` if the payload contract changes.
4. Update the relevant API route that persists or transforms the payload.
5. Update renderers such as `KnowledgeItemCard`, quiz/image/export UI, or chat condense preview if the user-visible shape changed.
6. Verify that stored `content` JSON remains parseable for both new and existing items.

## Verification
- Generate a fresh module and ensure it saves successfully.
- Expand an existing card and confirm children insert without collapsing unrelated UI state.
- If chat condense is involved, condense a conversation into a new card and verify the result renders.
- Run `npm run lint` after code changes.

## Common Failure Points
- Prompt and parser drift: model output shape changes but parser still expects old JSON.
- Stored JSON backward-compatibility: older modules may miss new fields.
- Export/image/chat flows may read the same content shape and break even if generation itself works.
- Follow-up behavior is easy to misread because both a dedicated follow-up route and a generic expand route exist.

## Related Docs
- [reference/api-surface.md](/Users/mac/VAST/知识系统/knowledge-system/llmdoc/reference/api-surface.md)
- [reference/runtime-and-deployment.md](/Users/mac/VAST/知识系统/knowledge-system/llmdoc/reference/runtime-and-deployment.md)
