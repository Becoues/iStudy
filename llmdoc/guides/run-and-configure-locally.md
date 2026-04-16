# How to Run and Configure Locally

## Preconditions
- Node.js 18+ and npm available if running the Next.js app directly.
- Docker Desktop available if using the Docker-first path.
- A valid DeerAPI-compatible API key if you want generation, expansion, chat, image generation, or AI polish to work.

## Main Steps
1. Install dependencies with `npm install` if `node_modules` is not already present.
2. Initialize the database with `npx prisma migrate dev`.
3. Start local dev with `npm run dev`, or use `./start.sh` for the Docker path.
4. Open the app and configure API key/model in the settings dialog.
5. Verify Obsidian export path if you plan to use export; default is `/Users/mac/Documents/Main/AI_talking`.

## Docker Notes
- `start.sh` checks Docker availability, ensures the Obsidian path exists, rebuilds when source or config is newer than the image, and then runs `docker compose up -d`.
- `docker-compose.yml` maps host port `3002` to container port `3000`.
- Docker and `npm run dev` should not be used against the same SQLite file at the same time.

## Verification
- Confirm the homepage loads and recent modules can be fetched.
- Generate a test module and verify it persists.
- If export matters, export one module and confirm the file lands in the configured path.

## Common Failure Points
- Missing API key results in generation or image/export polish failures.
- SQLite file contention can happen if Docker and local dev both write at once.
- Existing docs may mention older flows; confirm behavior against current code when debugging.

## Related Docs
- [reference/runtime-and-deployment.md](/Users/mac/VAST/知识系统/knowledge-system/llmdoc/reference/runtime-and-deployment.md)
- [architecture/integrations-and-exports.md](/Users/mac/VAST/知识系统/knowledge-system/llmdoc/architecture/integrations-and-exports.md)
