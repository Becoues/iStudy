# Architecture of Generation and Expansion Flow

## Purpose
- Convert user input or follow-up intent into structured knowledge items that can be persisted and rendered in the module tree.

## Core Components
- `src/app/page.tsx` (`Home`): Enqueues topic-generation tasks and saves completed root items.
- `src/lib/task-store.ts` (`useTaskStore`): Client-side async queue with task types, concurrency, retry, and cancellation.
- `src/lib/stream-runner.ts` (`runStream`): Shared SSE reader used by task execution.
- `src/app/api/knowledge/generate/route.ts`: Streams initial topic generation.
- `src/app/api/knowledge/expand/route.ts`: Streams child expansion.
- `src/app/api/knowledge/followup/route.ts`: Dedicated follow-up route for question-driven subitems.
- `src/lib/prompts.ts`: Prompt contracts for generation, expansion, chat, and condense.
- `src/lib/parseKnowledge.ts`: Recovers JSON from imperfect model output.
- `src/app/api/modules/route.ts`: Persists root module plus initial items.
- `src/app/api/modules/[id]/items/route.ts`: Persists expanded or newly created child items.

## Flow
- Homepage submit enqueues a `"generate"` task with the topic.
- `useTaskStore` starts queued tasks up to client-side concurrency `2`.
- `runStream` reads SSE chunks and accumulates text until a final `done` message.
- Completed generation output is parsed by `parseGenerationResponse`.
- The parsed payload is persisted through `POST /api/modules`, which creates the module and root items in one Prisma call.
- On the module page, clicking expand enqueues an `"expand"` task tied to a target item.
- Completed expansion output is parsed by `parseExpansionResponse` and persisted through `POST /api/modules/[id]/items`.
- Newly created children are inserted into local tree state to avoid a full-page refetch and card-collapse side effects.

## Invariants
- Generation and expansion routes speak the same SSE shape: chunk events carry `content`, completion carries `done` plus `fullContent`.
- The prompt contract expects strict JSON with `items`, and generation additionally expects `tags`.
- Parsing is intentionally lenient because the model may return markdown fences or wrapper text.
- Child-item persistence depends on depth and ordering checks in `/api/modules/[id]/items`.

## Current Caveats
- The task store defines a `"followup"` task type, but its default URL map points to `/api/knowledge/expand`; the dedicated `/api/knowledge/followup` route exists separately.
- Because prompts and parsing are tightly coupled, changing one without the other is high-risk.

## Related Docs
- [module-workspace-and-state.md](/Users/mac/VAST/知识系统/knowledge-system/llmdoc/architecture/module-workspace-and-state.md)
- [persistence-and-data-model.md](/Users/mac/VAST/知识系统/knowledge-system/llmdoc/architecture/persistence-and-data-model.md)
- [change-knowledge-item-workflow.md](/Users/mac/VAST/知识系统/knowledge-system/llmdoc/guides/change-knowledge-item-workflow.md)
