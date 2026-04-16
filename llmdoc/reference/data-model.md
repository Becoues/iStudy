# Data Model Reference

## Scope
- This document covers persistent entities and the structured content shape used by knowledge items.

## Prisma Entities
- `KnowledgeModule`
  Fields: `id`, `topic`, `tags`, `status`, `itemCount`, timestamps.
  Notes: `tags` is a JSON string, not a relation.
- `KnowledgeItem`
  Fields: `id`, `moduleId`, `parentId`, `orderIndex`, `title`, `difficulty`, `content`, `depth`, `createdAt`.
  Notes: `content` is a JSON string; `parentId` forms the recursive tree.
- `Comment`
  Fields: `id`, `itemId`, `content`, `createdAt`.
- `Settings`
  Fields: `id`, `provider`, `apiKey`, `model`, `obsidianPath`, `obsidianFolder`, `updatedAt`.

## Structured Content Shape
- `KnowledgeItemData`
  Fields: `title`, `difficulty`, `summary`, `details`, `mermaid`, `quiz`, optional `imageUrl`, optional `references`.
- `GenerationResponse`
  Fields: `tags`, `items`.
- `ExpansionResponse`
  Fields: `items`.

## Storage Conventions
- `KnowledgeModule.tags` is serialized with `JSON.stringify(tags)`.
- `KnowledgeItem.content` is serialized JSON and commonly includes markdown-rich `details`.
- Generated image URLs are stored back into `KnowledgeItem.content.imageUrl`, not in a separate DB column.
- Comment counts shown in the UI come from Prisma `_count` projections during module fetch.

## Tree and Depth Rules
- Root items use `parentId = null` and depth `0`.
- Child items use sibling-local `orderIndex`.
- Current API logic uses `MAX_DEPTH = 3` with a reject condition of `>= MAX_DEPTH`, so depth `3` is not actually allowed.
- Tree reconstruction is done in application code, both in the module fetch route and in frontend helpers.

## Sources of Truth
- `prisma/schema.prisma`
- `src/types/knowledge.ts`
- `src/app/api/modules/[id]/route.ts`
- `src/app/api/modules/[id]/items/route.ts`
- `src/app/api/items/[itemId]/route.ts`
