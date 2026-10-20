# Lockin Project State

## Current Phase
- Phase 1: Foundation (In Progress)

## Completed
- Initialized git repository with `main` tracking origin.
- Switched to `feat/phase-1-foundation`.
- Saved `AGENTS.md` with verbatim HARD RULES.

## In Progress / Next Steps
- Set up repo tooling (Next.js 15/14 App Router, TypeScript, Tailwind CSS, Prettier, ESLint).
- Configure Husky, commitlint, and custom commit-msg hook rejecting signatures.
- Configure GitHub Actions CI workflow (lint, typecheck, test, build).
- Implement Zod environment validation and `.env.example`.
- Setup cached Mongoose connection and MongoDB models/collections.
- Implement Auth.js v5 credentials auth with bcryptjs and Mongo rate limiting.
- Establish design system tokens, fonts, and dark-first palette.
- Build collapsible sidebar shell, mobile bottom nav, command palette skeleton.
- Place `public/logo.svg`, `public/logo-icon.svg`, and favicon.
- Run `pnpm verify` and open PR for Phase 1.
