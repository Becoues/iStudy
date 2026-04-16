# Architecture of Integrations and Exports

## Purpose
- Describe how external AI calls, image generation, export, settings, and deployment-facing scripts work together.

## Core Components
- `src/app/api/settings/route.ts`: Reads and writes the singleton settings row, masking API keys on GET.
- `src/app/api/knowledge/generate-image/route.ts`: Image generation, file write, and item-content update.
- `src/app/api/export/obsidian/route.ts`: Markdown export with optional AI polish.
- `src/components/knowledge/ExportObsidianDialog.tsx`: User-facing export controls.
- `start.sh`: Docker-first bootstrap helper for local operation.
- `docker-compose.yml`: Container runtime and bind mounts.
- `src/app/api/tasks/semaphore.ts`: In-memory server-side semaphore helpers.

## External Dependencies
- DeerAPI-compatible chat completion endpoint at `https://api.deerapi.com/v1`.
- `gemini-3-pro-image` for image generation.
- `gemini-3.1-flash-lite-preview` for export polish.
- Local filesystem for images and exported markdown.

## Flow
- Settings are loaded from SQLite and used directly by route handlers that need keys or model selection.
- Image generation creates a base64 image through the AI provider, writes it under `public/images/knowledge`, and stores `imageUrl` inside the item's content JSON.
- Export fetches the module tree, converts it to Markdown, optionally polishes with AI, then writes the file directly to the configured Obsidian path.
- Docker mode bind-mounts the SQLite data directory, generated-image directory, and Obsidian path to preserve local files outside the container.

## Current Caveats
- The stored `provider` value is not currently used to switch providers; route handlers hardcode DeerAPI-compatible client construction.
- `obsidianFolder` is stored in settings but not used during export; export writes directly into `obsidianPath`.
- The server semaphore endpoints appear unused by the current frontend; the active queueing mechanism is client-side Zustand state.

## Related Docs
- [run-and-configure-locally.md](/Users/mac/VAST/知识系统/knowledge-system/llmdoc/guides/run-and-configure-locally.md)
- [runtime-and-deployment.md](/Users/mac/VAST/知识系统/knowledge-system/llmdoc/reference/runtime-and-deployment.md)
