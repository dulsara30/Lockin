# LOCKIN: BUILD BRIEF (paste this whole file into Antigravity)

You are building **Lockin**, a premium work-planning web app. Read this once, then work strictly by phase. Save the "HARD RULES" section verbatim as `AGENTS.md` in the repo root in your first commit, and create `docs/STATE.md` (what's done / what's next, max 30 lines). At the start of every new session, read only `AGENTS.md` and `docs/STATE.md`, not the whole repo.

---

## HARD RULES (save as AGENTS.md)

### Git

1. NEVER add `Co-authored-by`, `Generated with`, agent names, or any signature to commits, PR titles or PR bodies. Commits are authored by the repo owner only.
2. Enforce this with a `commit-msg` hook (Husky + commitlint plus a custom check) that rejects any commit containing `Co-authored-by` or `Generated with`.
3. Conventional Commits. Small, focused commits. One branch per phase (`feat/phase-N-name`). NEVER commit to `main`.
4. Open a PR when a phase is done. NEVER merge until the owner says "merge". After merge, update `docs/STATE.md` and stop.

### Permission gates (ask first, wait for a clear yes)

- Installing a dependency NOT on the pre-approved list below
- Removing a dependency, deleting or renaming existing files
- Changing CI, hooks, env var names, DB indexes or schema outside the current phase
- Editing AGENTS.md
- Anything outside the current phase's scope

**Pre-approved dependencies** (no need to ask): next, react, typescript, tailwindcss, shadcn/ui (+ radix, lucide-react, class-variance-authority, clsx, tailwind-merge), framer-motion, @dnd-kit/*, @tanstack/react-query, zod, react-hook-form, mongoose, next-auth (Auth.js v5), bcryptjs, @google/genai, recharts, react-markdown, fractional-indexing, date-fns, date-fns-tz, cmdk, sonner, vitest, @playwright/test, eslint, prettier, husky, commitlint, lint-staged.

### Working style and token budget

- Phase scope in this brief is pre-approved. Do NOT write a separate plan; just build it.
- Smallest correct diff. No unrelated refactors. Never rewrite a whole file to change a few lines.
- Read only the files you need. Don't re-scan the repo. Don't re-print code you just wrote.
- Replies: max 5 lines per update. No re-explaining this brief.
- **Bulk verification only**: do NOT run tests, builds or dev servers after each step. Write the code for the whole phase, then run ONE `pnpm verify` (lint + typecheck + unit tests + build) at the end of the phase and fix everything in one pass. Playwright e2e runs only once, in the last phase.
- Use the cheapest model that can do the job. No AI calls from the app unless the user clicks.

### Security rules (non-negotiable)

- Every DB document has `userId`. Every query goes through a data-access layer that REQUIRES `userId`. Never query by id alone.
- All inputs validated with Zod on the server. No secrets in client code or logs.
- Never render raw HTML from user text (markdown only, no raw HTML).

---

## 1. PRODUCT

**Lockin** turns a big task into a pipeline of days. A **Mission** has N days (e.g. 5). Each day is a lane holding **Steps** (with estimate, status, subtasks). Lockin tracks planned vs actual, warns when a day is overloaded, rolls unfinished work forward, and shows whether the mission is On track, At risk or Behind.

Audience: me and friends I send the link to. Open signup. Multi-user, private workspace per user. Mobile-friendly. Minimal, fast, beautiful.

## 2. STACK

Next.js (latest stable, App Router), TypeScript strict, Tailwind + shadcn/ui, Framer Motion, dnd-kit, TanStack Query (optimistic updates), Zod shared schemas, MongoDB Atlas + Mongoose, Auth.js v5 Credentials (email + password, bcryptjs cost 12, JWT sessions; structure code so Google login can be added later), Recharts, Vitest, Playwright, pnpm, ESLint, Prettier, Husky, GitHub Actions CI, Vercel deploy (set region close to Atlas, e.g. `sin1` or `bom1`).

Folder layout: `src/app` (routes), `src/features/<feature>` (components, actions, schemas), `src/lib` (db, auth, ai, env, ratelimit, crypto), `src/server` (data-access layer, all queries scoped by userId), `tests/`.

## 3. DESIGN SYSTEM (UI quality is the priority)

Feel: Linear meets Things, with a Gen Z edge. Dark-first, minimal, lots of space, never generic.

Tokens (CSS variables, light theme variant too):

- bg `#0A0A12`, surface `#14141F`, border `#262637`, text `#F4F4FA`, muted `#9A9AB5`
- primary violet `#7C5CFF`, info cyan `#2DE2E6`, success/win lime `#C6FF3D` (only for wins: done, streaks, progress), warning amber `#FFB020`, danger coral `#FF5D73`
- Signature gradient `#7C5CFF -> #2DE2E6` for logo, progress rings, hero cards
- Fonts: Inter (UI), Geist Mono (timers, numbers). Radius 12-16px. Soft glass surfaces, subtle borders, no heavy shadows.
- Motion: small and purposeful (150-250ms). Confetti ONLY when a whole mission is completed. Respect `prefers-reduced-motion`.

Layout: **collapsible left sidebar** (Today, Quests/Missions, Planner, Insights, Templates, then mission list with color dots, Settings, user menu). On mobile: bottom tab bar. `Ctrl/Cmd+K` command palette for everything. Skeleton loaders everywhere, optimistic updates so it never feels slow, designed empty states, full keyboard support, WCAG AA contrast.

Logo: use `public/logo.svg` and `public/logo-icon.svg` (provided by the owner). Generate favicon/app icons from the icon.

## 4. DATA MODEL (all have userId, createdAt, updatedAt)

- **users**: email (unique, lowercased), passwordHash, name
- **missions**: title, description, color, priority, tags[], startDate, deadline, dayCount, status, archived
- **steps**: missionId, dayIndex, order (fractional-indexing string, so a drag is a single write), title, notes (markdown), estimateMin, actualMin, status (todo/doing/done/blocked/skipped), checklist[{text,done}], customFields{}
- **timeLogs**: stepId, startedAt, endedAt
- **activity**: append-only events (created, moved, completed, rolled_over) that power Insights and streaks
- **templates**: name, structure (same shape as the AI/import output)
- **settings**: theme, accent, density, timezone (default Asia/Colombo), weekStart, workHoursPerDay, capacityByWeekday, customStatuses, customFields defs, shortcut overrides, encrypted Gemini key (optional)
- **aiUsage**: userId, date, calls
- **rateLimits**: key, count, expiresAt (TTL index; serverless-safe, no in-memory limiting)

Indexes: `steps(userId, missionId, dayIndex, order)`, `steps(userId, status, dayIndex)`, `missions(userId, archived, deadline)`, `activity(userId, at)`, unique `users(email)`, TTL on rateLimits.

## 5. FEATURES

**Core**

- Mission CRUD with color, priority, tags, start date, deadline, day count.
- **Runway view** (hero screen): day columns connected by a line so it reads as a pipeline. Finished days glow lime, today is outlined violet, overloaded days turn amber with a capacity meter (planned hours vs daily capacity). Drag steps between days and reorder within a day (dnd-kit, keyboard accessible). Inline-add step per day.
- Step drawer: title, markdown notes, estimate, status, subtasks, custom fields, time logs.
- **Today view**: today's steps across all missions, a big "Next up" card, capacity meter, streak flame.
- **Lock-in mode**: full-screen single step, big mono timer (start/pause/stop writes timeLogs), UI dims, shortcut to complete and advance.
- **Roll over**: one click moves unfinished steps from past days to the next day(s) and shows the new risk status BEFORE applying (preview).
- Mission health badge (On track / At risk / Behind) computed from remaining estimate vs remaining capacity until deadline. Put this in a pure, well-tested function.
- **Insights**: burn-down, planned vs actual, completion rate, streak, busiest days, per-mission progress rings.
- Templates: save any mission as a template and reuse it.
- Export/import all data as JSON; export a mission as Markdown.

**Brain Dump to Plan (signature feature, two paths, ONE shared preview)**

- Path A, **AI**: big textbox "What are you trying to get done?" (messy text is fine; add browser voice input). User picks days and hours/day, then Generate. Gemini returns a full mission with day-wise steps, estimates, priorities and subtasks.
- Path B, **Template import (no AI cost)**: user downloads a template file (Markdown or JSON, with format spec and example), fills it by hand or with any chatbot, then uploads or pastes it. A plain-code parser (no AI) converts it. Also supports pasting a plain checklist, which gets auto-distributed across N days by estimate.
- Both paths land on the same **Preview screen**: edit titles, estimates and days, drag steps between days, delete items. NOTHING is saved until the user clicks Confirm.
- Markdown template format:

```
# Mission: <title>
days: 5
hoursPerDay: 4
priority: high
tags: research, writing
description: <text>

## Day 1
- [ ] Step title | 45m | high | optional note
  - [ ] subtask
```

- **Re-plan**: when behind, AI (or a simple code fallback) redistributes remaining steps over remaining days, shown as a preview.
- **Daily brief**: optional short AI summary on the Today view (manual button only).

**Customization (everything configurable in Settings)**
Theme (dark/light/system), accent color, density, timezone, week start, working hours and per-weekday capacity, custom statuses, custom fields, default view, dashboard widgets on/off, shortcut remapping.

## 6. AI RULES (Gemini)

- Server-side only via `@google/genai`. Model name comes from env `GEMINI_MODEL`. Check Google's current docs and use the cheapest Flash / Flash-Lite model as the default.
- Key resolution: the user's own key from Settings (stored AES-256-GCM encrypted with env `ENCRYPTION_KEY`) if present, otherwise shared env `GEMINI_API_KEY`.
- Shared key cap: 10 AI calls per user per day (env-configurable). Own key: 100/day. Counted in `aiUsage`. Show remaining calls in the UI.
- Structured JSON output with a response schema, validated by Zod. One retry on invalid output, then a friendly error with a link to the template import path as the fallback.
- Truncate input to 4,000 chars. Treat user text strictly as data, never as instructions. Cache by input hash. Only run on explicit user click, never in the background.

## 7. SECURITY AND PRODUCTION

- Signup/login/AI endpoints rate limited via the Mongo TTL `rateLimits` collection. Generic auth error messages. Password min 8 chars. Email normalized.
- Security headers in `next.config` (CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy, HSTS).
- Env validated with Zod at startup; fail fast with clear errors. Ship `.env.example`.
- Cached Mongoose connection (global) to avoid connection storms on serverless.
- `/api/health` route. Error boundaries, `not-found` and `error` pages, structured server logging without PII.
- Pagination or limits on list queries, `.lean()` for reads, no N+1.
- GitHub Actions CI: install, lint, typecheck, test, build on PRs.
- README: setup, env vars, scripts, deploy to Vercel.

Required env vars: `MONGODB_URI`, `AUTH_SECRET`, `GEMINI_API_KEY`, `ENCRYPTION_KEY`, `GEMINI_MODEL`, `AI_DAILY_CAP_SHARED`.

## 8. PHASES (one PR each; stop after opening each PR and wait for "merge")

1. **Foundation**: repo tooling, AGENTS.md, hooks (including the co-author blocker), CI, env validation, Mongo connection, Auth.js signup/login, design tokens, sidebar shell, command palette skeleton, logo and favicon.
2. **Core planning**: missions + steps CRUD, data-access layer, Runway view with drag and drop, step drawer, Today view, Lock-in mode, timer, roll over, capacity and health logic with unit tests.
3. **Brain Dump**: template download, parser, AI plan endpoint, shared preview + confirm flow, aiUsage caps, BYOK key setting, re-plan.
4. **Insights + customization**: charts, streaks, templates, settings (all customization), export/import.
5. **Hardening and launch**: accessibility pass, performance pass, error states, Playwright e2e for signup -> brain dump -> runway -> complete, security headers, README, Vercel deploy checklist.

After each phase: run `pnpm verify` ONCE, fix, commit, open the PR, update `docs/STATE.md`, and report in 5 lines or fewer.

## 9. START

Begin Phase 1 now. Don't ask me questions unless something blocks you.
