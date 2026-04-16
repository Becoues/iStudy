# Runtime and Deployment Reference

## Scope
- This document captures commands, runtime paths, deployment assumptions, and known implementation caveats.

## Commands
- `npm run dev`: Start Next.js dev server.
- `npm run build`: Build production assets.
- `npm run start`: Start production Next.js server.
- `npm run lint`: Run ESLint.
- `npx prisma migrate dev`: Apply local schema migrations.
- `./start.sh`: Docker-first local bootstrap script.

## Runtime Paths
- Database default: `data/istudy.db`.
- Generated images: `public/images/knowledge/`.
- Obsidian export default: `/Users/mac/Documents/Main/AI_talking`.
- Docker port mapping: host `3002` -> container `3000`.

## Deployment Notes
- Docker bind-mounts the database directory, generated-image directory, and Obsidian export path.
- `start.sh` performs rebuild checks against key files and source directories before restarting containers.
- SQLite means concurrent multi-process writers should be treated cautiously; do not run Docker and local dev against the same DB at the same time.

## Current Caveats
- `CLAUDE.md` still references `src/lib/openai.ts`, but current route handlers create clients inline.
- The stored `provider` field does not currently change route behavior; DeerAPI-compatible config is hardcoded.
- `Settings.obsidianFolder` is currently unused by the export route.
- The task semaphore API exists server-side but is not used by the current frontend task queue.
- The task-store `"followup"` URL map points to `/api/knowledge/expand`, even though a dedicated `/api/knowledge/followup` route exists.

## Sources of Truth
- `package.json`
- `src/lib/prisma.ts`
- `src/app/api/settings/route.ts`
- `src/app/api/export/obsidian/route.ts`
- `start.sh`
- `docker-compose.yml`
