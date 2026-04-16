# Architecture of Module Workspace and State

## Purpose
- Define how the module detail page coordinates the learning workspace, tree interactions, comments, favorites, and chat context.

## Core Components
- `src/app/modules/[id]/page.tsx` (`ModuleDetailPage`): Top-level orchestrator for the module workspace.
- `src/components/knowledge/KnowledgeItemList.tsx`: Recursive item rendering entry.
- `src/components/knowledge/KnowledgeItemCard.tsx`: Card-level actions and content rendering.
- `src/components/knowledge/KnowledgeToc.tsx`: Left-side tree navigation and scroll-linked highlighting.
- `src/components/layout/RightPanel.tsx`: Favorites/comments panel shell.
- `src/components/chat/ChatPanel.tsx`: Context-aware module chat and condense flow.
- `src/hooks/useModuleChat.ts`: Chat storage, streaming, condense, and clear behavior.
- `src/hooks/useFavorites.ts`: Favorite persistence keyed by module id.

## State Boundaries
- Persisted in DB:
  modules, items, comments, settings, exported files, generated image file references.
- Persisted in local storage:
  favorites, chat transcript per module, TOC width, right-panel width, some generation state, image collapse state.
- Ephemeral page state:
  selected item, active tab, comment form state, expand task watches, resize drag state.

## Flow
- Module page fetches a fully reconstructed tree from `GET /api/modules/[id]`.
- Clicking a card selects it and can pivot the right panel into comments or provide context to chat.
- Comments mutate through `/api/comments` routes and then refresh item counts through module refetch.
- Expansion completion inserts children into local state rather than forcing a full reload.
- Chat can use the selected item or a pinned item as focused context, then condense the conversation into a new knowledge item.

## Invariants
- Selected item and pinned chat item are different concepts; pinning must survive selection changes.
- Comment counts displayed on cards come from backend `_count` values, not from local optimistic bookkeeping.
- The workspace assumes nested items remain stable enough for scroll spy and TOC highlighting to target DOM ids.
- Card rendering expects `KnowledgeItem.content` to already be parsed into structured JSON on the client.

## Related Docs
- [generation-and-expansion-flow.md](/Users/mac/VAST/知识系统/knowledge-system/llmdoc/architecture/generation-and-expansion-flow.md)
- [persistence-and-data-model.md](/Users/mac/VAST/知识系统/knowledge-system/llmdoc/architecture/persistence-and-data-model.md)
- [api-surface.md](/Users/mac/VAST/知识系统/knowledge-system/llmdoc/reference/api-surface.md)
