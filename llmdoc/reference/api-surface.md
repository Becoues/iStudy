# API Surface Reference

## Scope
- This document lists the main route handlers and the contracts they serve today.

## Knowledge Generation and Expansion
- `POST /api/knowledge/generate`
  Expects `topic`.
  Streams SSE chunks and final generated module content.
- `POST /api/knowledge/expand`
  Expects parent item fields such as `title`, `summary`, `difficulty`, `details`.
  Streams child knowledge items in the same SSE envelope.
- `POST /api/knowledge/followup`
  Expects the same parent fields plus `question`.
  Streams targeted child knowledge items for a follow-up question.
- `POST /api/knowledge/generate-image`
  Expects `itemId`, `title`, `summary`.
  Returns `{ imageUrl }` after writing the generated file and updating item content.
- `DELETE /api/knowledge/image/[filename]`
  Used by card UI to remove a generated image.

## Module and Item Persistence
- `GET /api/modules`
  Lists modules with optional `search`, `tags`, and `sort`.
- `POST /api/modules`
  Creates a module plus optional initial items.
- `GET /api/modules/[id]`
  Returns the module plus a reconstructed nested item tree and parsed tags/content.
- `PATCH /api/modules/[id]`
  Updates module `topic` and/or `tags`.
- `DELETE /api/modules/[id]`
  Deletes the module.
- `POST /api/modules/[id]/items`
  Supports batch child creation and single-item creation.
  Enforces parent validity and depth constraints.
- `PATCH /api/items/[itemId]`
  Supports legacy up/down reorder and newer reparent/reorder mode.
- `DELETE /api/items/[itemId]`
  Deletes an item plus descendants, then recomputes module item count.

## Comments and Settings
- `POST /api/comments`
  Creates a comment for an item.
- `GET /api/comments/[itemId]`
  Lists comments for an item.
- `PUT` and `DELETE /api/comments/[commentId]`
  Update or remove a comment.
- `GET /api/settings`
  Returns masked settings, creating the singleton row if missing.
- `PUT /api/settings`
  Upserts provider, key, model, and Obsidian export settings.

## Chat and Export
- `POST /api/chat/send`
  Streams assistant chat grounded in module context and optional focused item.
- `POST /api/chat/condense`
  Returns a single `KnowledgeItemData`-shaped object derived from conversation history.
- `POST /api/export/obsidian`
  Exports a full module or one item to Markdown, optionally with AI polish.

## Task Helpers
- `POST /api/tasks/acquire`
  Grants or denies a server semaphore slot.
- `POST /api/tasks/release`
  Releases a semaphore token.

## Sources of Truth
- `src/app/api/**`: Current route implementations.
- `src/types/knowledge.ts`: Client-facing data contracts.
- `src/lib/prompts.ts`: Model-output expectations for AI routes.
