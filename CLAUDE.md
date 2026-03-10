# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

iStudy — AI 知识学习系统。面向学生的 AI 驱动知识学习平台，输入主题自动生成结构化知识卡片，支持流程图、测验、AI 配图、多级展开、收藏和评论。UI 全中文。

## Tech Stack

- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript
- **Database**: Prisma 7 + SQLite via `@prisma/adapter-better-sqlite3` (no Rust engine)
- **AI**: OpenAI SDK with DeerAPI endpoint (`https://api.deerapi.com/v1`)
- **Image Gen**: `gemini-3-pro-image` model via DeerAPI, returns base64 PNG in content
- **UI**: Shadcn/ui (base-nova style) + Tailwind CSS 4 + Lucide React
- **Diagrams**: Mermaid.js (dynamic import, SSR disabled)
- **Math**: KaTeX via remark-math + rehype-katex
- **Streaming**: TransformStream + SSE for AI responses

## Commands

```bash
npm run dev          # Dev server on port 3000
npm run build        # Production build
npm run lint         # ESLint
npx prisma migrate dev   # Run DB migrations
npx prisma generate      # Regenerate Prisma client (→ src/generated/prisma/)
```

## Architecture

### Layout
Module detail page uses a three-panel layout: sticky left TOC + scrollable center cards + sticky right panel (favorites/comments tabs). TopNav and header scroll with content. FAB (FollowUpFab) is draggable with edge snapping.

### Data Flow
1. **Generation**: Topic → `POST /api/knowledge/generate` (SSE) → parse JSON → `POST /api/modules` to persist
2. **Expansion**: "深入了解" → `POST /api/knowledge/expand` (SSE) → `POST /api/modules/[id]/items` to persist children
3. **Image Gen**: "生成配图" → `POST /api/knowledge/generate-image` → calls `gemini-3-pro-image` → extracts base64 from response → saves to `public/images/knowledge/{itemId}.{ext}` → updates item content JSON with `imageUrl`
4. **Favorites**: localStorage per module (`knowledge-favorites:{moduleId}`)
5. **Comments**: DB-persisted via `/api/comments`. Module page does silent refresh (`fetchModule(true)`) after add/delete to update counts without loading flicker.

### Key Patterns

- **Prisma 7 adapter**: PrismaClient requires `adapter` param — see `src/lib/prisma.ts`. Global singleton for dev hot-reload.
- **SSE streaming**: API routes use `TransformStream` + `text/event-stream`. Chunks: `data: {content}\n\n`, completion: `data: {done: true, fullContent}\n\n`.
- **JSON parsing**: AI output may include markdown fences. `src/lib/parseKnowledge.ts` uses 3-stage fallback: direct parse → strip fences → brace-matching.
- **Self-referential tree**: `KnowledgeItem.parentId` for recursive expansion (max depth 3). `buildItemTree()` converts flat rows to nested structure.
- **Comment counts**: Prisma `_count: { select: { comments: true } }` on KnowledgeItem queries; mapped to `commentCount` field. Hidden on cards when 0.
- **Image in content JSON**: `imageUrl` stored in item's `content` JSON field (no DB migration needed). `KnowledgeItemCard` manages local `imageUrl` state synced via `useEffect`.
- **Next.js 16 params**: Route params are `Promise<{ id: string }>` — must be awaited.

### Database Schema (SQLite)
- `KnowledgeModule` — topic, tags (JSON string), status, itemCount
- `KnowledgeItem` — self-referential via parentId, content as JSON string, depth tracking
- `Comment` — per-item, cascade delete with parent item
- `Settings` — singleton (id=1) for API key/model config

### Important Files
- `src/app/modules/[id]/page.tsx` — Module detail page, core state management, three-panel layout
- `src/components/knowledge/KnowledgeItemCard.tsx` — Card component with recursive children, image gen, comments
- `src/components/knowledge/FollowUpFab.tsx` — Draggable FAB with Pointer Events + edge snapping
- `src/lib/prompts.ts` — Chinese system/user prompts for generation and expansion
- `src/lib/openai.ts` — OpenAI client factory from DB Settings
- `src/hooks/useStreamResponse.ts` — SSE stream reader with AbortController
- `src/types/knowledge.ts` — All shared TypeScript interfaces
- `src/app/api/knowledge/generate-image/route.ts` — Image generation endpoint

### Quiz Answer Format
AI returns answers as letter strings ("A", "B", "C", "D"). QuizSection converts via `charCodeAt(0) - 65` to get index.
