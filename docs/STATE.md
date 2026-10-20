# Lockin Project State

## Current Phase

- Phase 2: Core Planning (In Progress)

## Completed

- Phase 1: Foundation merged into `main` (tooling, hooks, CI, env, MongoDB, Auth.js v5 credentials, dark-first UI shell).

## In Progress / Next Steps

- Mission and Step Mongoose models + indexes.
- Security-enforced Data Access Layer (`src/server/dal/`) requiring `userId` on all queries.
- Pure mission capacity & health logic (On track, At risk, Behind) + Vitest unit tests.
- Missions CRUD (create, update, delete, archive) with priority, tags, dayCount.
- Steps CRUD with fractional indexing for single-write reordering.
- Runway view hero pipeline connecting day columns with glow states and capacity meters.
- Drag-and-drop step reordering within and across days via `@dnd-kit`.
- Step drawer for title, markdown notes, estimates, subtask checklist, custom fields.
- Today view integrating all missions, "Next Up" card, capacity meter, streak flame.
- Lock-in mode full-screen single-step focus with big mono timer and timeLog writes.
- Roll over preview & apply logic moving unfinished steps forward.
- Phase 2 bulk verification (`pnpm verify`) and PR opening.
