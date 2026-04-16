# Working Agreement

## How To Work In This Repo
- Prefer docs first, then verify against code and config.
- Preserve user-visible Chinese copy and existing product tone unless the task explicitly changes it.
- Treat `README.md`, `CLAUDE.md`, and `llmdoc/` as aids, not authority over current runtime behavior.
- Keep investigation scratch under `.llmdoc-tmp/`; keep stable facts in `llmdoc/`.

## Verification Expectations
- Use `npm run lint` for broad frontend/API safety when a change touches TypeScript code.
- Use targeted runtime checks when changing Prisma routes, export paths, or stream behavior.
- When editing persistence or tree logic, verify order, depth, and comment-count behavior rather than only checking compile success.

## Known Drift To Remember
- `CLAUDE.md` references `src/lib/openai.ts`, but current routes create `OpenAI` clients inline.
- The repo contains a dedicated `/api/knowledge/followup` route, but the task-store URL map points `"followup"` tasks to `/api/knowledge/expand`.
- `Settings.obsidianFolder` is stored, but export currently writes directly to `obsidianPath`.
- Server semaphore endpoints exist but are not wired into the current frontend flow.
