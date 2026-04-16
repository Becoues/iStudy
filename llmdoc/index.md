# llmdoc Index

## Purpose
- This file is the global map of the `llmdoc` system for this repository.
- Read [startup.md](/Users/mac/VAST/知识系统/knowledge-system/llmdoc/startup.md) for recurring startup context.

## Categories
- `must/`: Startup pack for recurring project context and work rules.
- `overview/`: What the product is, who it serves, and what belongs here.
- `architecture/`: Runtime flows, ownership boundaries, and invariants.
- `guides/`: Workflow-specific instructions for common changes.
- `reference/`: Stable facts, schemas, routes, and runtime conventions.
- `memory/`: Decisions and reflections that should not be mixed into stable docs.

## Key Documents
- [llmdoc/startup.md](/Users/mac/VAST/知识系统/knowledge-system/llmdoc/startup.md): Required startup reading order.
- [llmdoc/overview/project-overview.md](/Users/mac/VAST/知识系统/knowledge-system/llmdoc/overview/project-overview.md): Product identity, users, boundaries, and major areas.
- [llmdoc/architecture/generation-and-expansion-flow.md](/Users/mac/VAST/知识系统/knowledge-system/llmdoc/architecture/generation-and-expansion-flow.md): Topic generation, expansion, follow-up, and parse/persist flow.
- [llmdoc/architecture/module-workspace-and-state.md](/Users/mac/VAST/知识系统/knowledge-system/llmdoc/architecture/module-workspace-and-state.md): Three-panel module workspace and local state ownership.
- [llmdoc/architecture/persistence-and-data-model.md](/Users/mac/VAST/知识系统/knowledge-system/llmdoc/architecture/persistence-and-data-model.md): SQLite schema, tree integrity, and mutation invariants.
- [llmdoc/architecture/integrations-and-exports.md](/Users/mac/VAST/知识系统/knowledge-system/llmdoc/architecture/integrations-and-exports.md): DeerAPI, image generation, export, and deployment-facing integrations.
- [llmdoc/guides/run-and-configure-locally.md](/Users/mac/VAST/知识系统/knowledge-system/llmdoc/guides/run-and-configure-locally.md): Local startup, Docker mode, and settings checklist.
- [llmdoc/guides/change-knowledge-item-workflow.md](/Users/mac/VAST/知识系统/knowledge-system/llmdoc/guides/change-knowledge-item-workflow.md): Safe way to change AI output contracts or card behavior.
- [llmdoc/reference/api-surface.md](/Users/mac/VAST/知识系统/knowledge-system/llmdoc/reference/api-surface.md): Route map and request/response expectations.
- [llmdoc/reference/data-model.md](/Users/mac/VAST/知识系统/knowledge-system/llmdoc/reference/data-model.md): Prisma entities and JSON-backed content shape.
- [llmdoc/reference/runtime-and-deployment.md](/Users/mac/VAST/知识系统/knowledge-system/llmdoc/reference/runtime-and-deployment.md): Commands, paths, and current implementation caveats.

## Routing Rules
- Read [startup.md](/Users/mac/VAST/知识系统/knowledge-system/llmdoc/startup.md) first on new sessions.
- Read the relevant `architecture/` doc before changing any major user-facing flow.
- Read [guides/change-knowledge-item-workflow.md](/Users/mac/VAST/知识系统/knowledge-system/llmdoc/guides/change-knowledge-item-workflow.md) before changing prompts, parsing, item persistence, or knowledge-card rendering.
- Read [reference/runtime-and-deployment.md](/Users/mac/VAST/知识系统/knowledge-system/llmdoc/reference/runtime-and-deployment.md) before changing startup scripts, settings, exports, or deployment assumptions.
- Treat `.llmdoc-tmp/` as scratch only; do not cite it as stable project memory.
