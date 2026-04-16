# Architecture of Persistence and Data Model

## Purpose
- Describe how the app stores modules, tree items, comments, and settings, and how it preserves tree integrity during mutation.

## Core Components
- `prisma/schema.prisma`: Source of truth for entities and indexes.
- `src/lib/prisma.ts`: Better SQLite adapter and absolute database-path resolution.
- `src/app/api/modules/[id]/route.ts`: Module fetch, safe item-content parsing, and module patch/delete.
- `src/app/api/modules/[id]/items/route.ts`: Root/child item creation with order and depth handling.
- `src/app/api/items/[itemId]/route.ts`: Delete, reorder, reparent, and recursive depth updates.
- `src/lib/parseKnowledge.ts` (`buildItemTree`): Client-side tree reconstruction helper for flat data.

## Data Ownership
- `KnowledgeModule`: Owns module-level identity, tag JSON string, status, and item count.
- `KnowledgeItem`: Owns tree edges through `parentId`, ordering via `orderIndex`, and structured content via JSON string.
- `Comment`: Belongs to one item and cascades on item delete.
- `Settings`: Singleton row for API/model/export configuration.

## Invariants
- SQLite is file-backed and resolved to `data/istudy.db` unless `DATABASE_URL` overrides it.
- `KnowledgeItem.content` is expected to serialize a `KnowledgeItemData`-shaped object.
- `KnowledgeModule.tags` is stored as a JSON string, so tag filtering happens in application code.
- Maximum nesting is enforced with `MAX_DEPTH = 3`, but code rejects `newDepth >= MAX_DEPTH`, so valid stored depth values are effectively `0`, `1`, and `2`.
- Item ordering is sibling-local and depends on `orderIndex`; move and insert operations may shift siblings to make room.
- Tree delete is manual and recursive at the API layer before module item counts are recomputed.

## Failure-Prone Areas
- Invalid JSON in stored item content can break parsing; the module fetch route uses `safeParseJson` to sanitize control characters before parsing.
- Reparenting must prevent circular references and descendant depth overflow.
- Any route that changes item counts must update `KnowledgeModule.itemCount` explicitly.

## Related Docs
- [data-model.md](/Users/mac/VAST/知识系统/knowledge-system/llmdoc/reference/data-model.md)
- [api-surface.md](/Users/mac/VAST/知识系统/knowledge-system/llmdoc/reference/api-surface.md)
