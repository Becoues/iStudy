# Project Overview

## Identity
- `iStudy` turns a user topic into a structured knowledge module aimed at guided learning.
- It is designed for a student-facing experience: concise summaries, deeper explanations, diagrams, quizzes, follow-up exploration, and note export.

## Users
- Primary users are Chinese-speaking learners exploring a topic step by step.
- The system assumes users may not be technical, so setup and UI actions are intentionally simple.

## What Belongs Here
- Topic-based AI generation and recursive knowledge expansion.
- A persistent module workspace with comments, favorites, chat, and export.
- Local or Docker-based operation with a file-backed SQLite database.

## What Does Not Belong Here
- Multi-user collaboration, auth, or remote shared workspaces.
- A generalized CMS or arbitrary note-taking platform.
- A provider-agnostic AI abstraction layer; current implementation is tightly shaped around DeerAPI-compatible chat routes.

## Major Areas
- Generation entry: homepage form, task queue, and root module persistence.
- Learning workspace: module page, tree navigation, card actions, comments, favorites, and chat.
- Persistence: Prisma-backed module/item/comment/settings storage with tree reconstruction in app code.
- Integrations: image generation, Obsidian export, settings management, and Docker startup.
