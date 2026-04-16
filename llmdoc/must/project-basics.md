# Project Basics

## Identity
- This repo builds `iStudy`, a Chinese-language AI knowledge learning system for students.
- The main user flow is topic generation -> module exploration -> recursive expansion -> note/chat/export actions.

## Stack
- Frontend: Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, shadcn/base-nova components.
- Persistence: Prisma 7 with `@prisma/adapter-better-sqlite3` on SQLite.
- AI: `openai` SDK against DeerAPI-compatible endpoints, plus Gemini image and polish models through the same client pattern.
- State helpers: Zustand for the client task queue, local storage for some UI/session state.

## Main Runtime Areas
- `src/app/page.tsx`: Homepage generation entry and recent-module list.
- `src/app/modules/[id]/page.tsx`: Main learning workspace with TOC, cards, comments, chat, and export.
- `src/app/api/**`: Route handlers for generation, persistence, comments, settings, chat, export, and images.
- `src/lib/**`: Parsing, prompts, stream runner, Prisma client, and tree utilities.
- `prisma/schema.prisma`: Persistent data model.

## Storage and Paths
- SQLite file defaults to `data/istudy.db`.
- Generated card images live under `public/images/knowledge/`.
- Obsidian export writes into the configured `obsidianPath`, defaulting to `/Users/mac/Documents/Main/AI_talking`.

## High-Value Caveats
- `README.md` and `CLAUDE.md` are both useful, but code is the source of truth when they diverge.
- Current code still stores tags and item content as JSON strings in SQLite.
- The UI and prompts are Chinese-first; preserve that unless the task explicitly changes product language.
