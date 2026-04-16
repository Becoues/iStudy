# Initial llmdoc Baseline

## Decision
- Organize the initial stable docs by runtime flow and ownership boundaries, not by top-level directory listing.

## Why
- The highest-risk changes in this repo are cross-cutting: prompts, parsing, persistence, module orchestration, and export all interact.
- A directory-by-directory index would not help future sessions reason about those flows quickly enough.

## Result
- Stable docs center on four architecture slices:
  generation/expansion,
  module workspace/state,
  persistence/data model,
  integrations/exports.
- Startup docs explicitly call out current drift between older docs and code.

## Revisit When
- The repo adds authentication, multi-user behavior, or a background worker model that changes the current flow boundaries.
