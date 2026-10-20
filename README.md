<img src="public/logo.svg" alt="Lockin" height="48" />

# Lockin - Mission-Driven Work Planning

> **Turn big tasks into a pipeline of days.**  
> Lockin is a premium, dark-first work-planning app that breaks complex initiatives into sequenced daily lanes - with workload capacity forecasting, drag-and-drop pipelines, a focus timer, and AI-powered planning.

[![CI](https://github.com/dulsara30/Lockin/actions/workflows/ci.yml/badge.svg)](https://github.com/dulsara30/Lockin/actions/workflows/ci.yml)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![MongoDB Atlas](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb)](https://www.mongodb.com/atlas)
[![License: MIT](https://img.shields.io/badge/License-MIT-violet.svg)](LICENSE)

---

## ✨ Feature Overview

### 🚀 Runway View - Hero Pipeline

- Visual day columns connected by a pipeline line - see your entire sprint at a glance
- **Finished days** glow lime, **today** is outlined violet, **overloaded days** turn amber
- Per-day capacity meters (planned hours vs daily limit)
- Drag steps between days and reorder within a day - single fractional-index write to DB
- Inline step creation per day lane

### 🎯 Mission Control

- Create missions with title, description, color, priority, tags, start date, deadline, and day count
- Full CRUD with cascade deletion and archive/restore
- Mission health badge: **On track / At risk / Behind / Completed** - computed by a pure, well-tested function from remaining estimate vs remaining capacity

### ✅ Step Management

- Rich step drawer: title, markdown notes (rendered safely via react-markdown), estimate, status picker, subtask checklist, time log history
- Statuses: `todo · doing · done · blocked · skipped`
- Quick-toggle done from Runway and Today views
- All queries scoped by `userId` through a mandatory data-access layer - never by ID alone

### ⚡ Lock-In Mode

- Full-screen focus on a single step
- Big mono timer (start / pause / stop) - every session automatically writes a `timeLog`
- Tracks actual vs estimated time; `actualMin` updated on step after each session
- Keyboard-accessible; respects `prefers-reduced-motion`

### 📅 Today View

- Today's steps across all active missions in one dashboard
- **Next Up** hero card with one-click Lock-In entry
- Daily capacity meter (planned vs 4h default)
- Streak flame counter from activity history

### 🔁 Roll Over

- One-click preview of moving unfinished past steps to the next day
- Shows **before / after health badge** and capacity impact before applying
- Preview is computed by a pure function - nothing written until confirmed

### 🤖 Brain Dump to Plan (Phase 3)

- **AI path:** big textbox → Gemini generates a full mission with day-wise steps, estimates, priorities, and subtasks
- **Template path:** download Markdown / JSON template, fill it manually or with any LLM, upload/paste → parsed without AI cost
- Both land on a shared **Preview screen**: edit, drag, delete - nothing saved until Confirm
- Re-plan: redistributes remaining steps over remaining days when behind

### 📊 Insights (Phase 4)

- Burn-down chart, planned vs actual time, completion rate, streak, busiest days
- Per-mission progress rings

### 🎨 Design System

- Dark-first with CSS variable tokens (`#0A0A12` bg, `#7C5CFF` primary, `#2DE2E6` info, `#C6FF3D` success/wins)
- Signature violet→cyan gradient for logo, progress rings, and hero cards
- Inter (UI) + Geist Mono (timers, numbers)
- Glass surfaces, subtle borders, purposeful motion (150–250ms)
- Confetti **only** when a whole mission completes; respects `prefers-reduced-motion`
- Full dark/light theme, WCAG AA contrast throughout

### ⌨️ Command Palette

- `Ctrl/Cmd+K` opens the palette from anywhere
- Navigate, create missions, start Brain Dump, enter Lock-In - all from the keyboard

### 🔒 Security

- Every DB document has `userId`; every query goes through a DAL that requires it
- All server inputs validated with Zod; no secrets in client code or logs
- Passwords hashed with bcryptjs (cost 12); email normalized on write
- Rate limiting via MongoDB TTL collection - serverless-safe, no in-memory state
- AES-256-GCM encrypted BYOK Gemini API key
- Security headers (CSP, X-Frame-Options, HSTS, Permissions-Policy) in `next.config.ts`

---

## 🗂️ Project Structure

```
src/
├── app/                   # Next.js App Router routes
│   ├── (app)/             # Authenticated route group with sidebar layout
│   │   ├── today/         # Today dashboard
│   │   ├── missions/      # Missions list + new mission form
│   │   ├── runway/        # Runway pipeline hero view
│   │   ├── lockin/        # Lock-in focus mode
│   │   ├── insights/      # Analytics (Phase 4)
│   │   ├── templates/     # Templates (Phase 4)
│   │   └── settings/      # User settings (Phase 4)
│   ├── api/
│   │   ├── auth/          # Auth.js handler
│   │   └── health/        # /api/health status endpoint
│   ├── login/             # Sign-in page
│   └── signup/            # Registration page
│
├── features/              # Feature-sliced components and actions
│   ├── auth/              # Login, signup forms and server actions
│   ├── missions/          # Mission CRUD forms, list view, server actions, Zod schemas
│   ├── steps/             # Step drawer component
│   ├── runway/            # Runway pipeline, day column, step card, rollover modal
│   ├── today/             # Today dashboard components
│   └── lockin/            # Lock-in mode view with timer
│
├── server/
│   ├── models/            # Mongoose models (User, Mission, Step, TimeLog, Activity, RateLimit)
│   └── dal/               # Data-access layer - all queries require userId
│       ├── missions.ts
│       ├── steps.ts
│       ├── timeLogs.ts
│       └── today.ts
│
├── lib/                   # Shared utilities
│   ├── db.ts              # Cached Mongoose connection (dbName: Lockin)
│   ├── auth.ts            # Auth.js v5 NextAuth config with Credentials provider
│   ├── auth.config.ts     # Edge-compatible auth config (for middleware)
│   ├── env.ts             # Zod environment validation - fails fast at startup
│   ├── ratelimit.ts       # MongoDB TTL-backed rate limiter
│   ├── planning.ts        # Pure mission health & capacity engine (fully unit tested)
│   └── utils.ts           # cn() and helpers
│
├── components/
│   ├── ui/                # Design system primitives (Button, Input, Dialog, Command…)
│   ├── layout/            # Sidebar, MobileNav, CommandPalette
│   └── providers.tsx      # SessionProvider, QueryClientProvider, Toaster
│
└── middleware.ts           # Auth middleware protecting app routes
```

---

## 🛠️ Tech Stack

| Layer         | Technology                                   |
| ------------- | -------------------------------------------- |
| Framework     | Next.js 15 (App Router, RSC, Server Actions) |
| Language      | TypeScript (strict mode)                     |
| Styling       | Tailwind CSS 3 + custom design tokens        |
| UI Components | Radix UI primitives + shadcn/ui patterns     |
| Drag & Drop   | @dnd-kit/core + @dnd-kit/sortable            |
| State         | TanStack Query v5 (optimistic updates)       |
| Forms         | react-hook-form + Zod                        |
| Animation     | Framer Motion                                |
| Database      | MongoDB Atlas via Mongoose 8                 |
| Auth          | Auth.js v5 (Credentials; Google-ready)       |
| Passwords     | bcryptjs (cost 12)                           |
| AI            | Google Gemini via `@google/genai`            |
| Testing       | Vitest (unit) + Playwright (e2e, Phase 5)    |
| Linting       | ESLint (next/core-web-vitals) + Prettier     |
| Commits       | Husky + commitlint (Conventional Commits)    |
| CI            | GitHub Actions                               |
| Deploy        | Vercel (region: `sin1` / `bom1`)             |

---

## ⚙️ Setup & Development

### Prerequisites

- Node.js 22+
- pnpm 12+
- MongoDB Atlas cluster (free tier works fine)
- Google Gemini API key (optional for AI features)

### 1. Clone & Install

```bash
git clone https://github.com/dulsara30/Lockin.git
cd Lockin
pnpm install
pnpm approve-builds --all
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

| Variable              | Required | Description                                                           |
| --------------------- | -------- | --------------------------------------------------------------------- |
| `MONGODB_URI`         | ✅       | MongoDB Atlas connection string - **must point to `Lockin` database** |
| `AUTH_SECRET`         | ✅       | Random 32+ byte secret for JWT signing                                |
| `GEMINI_API_KEY`      | ✅       | Shared Gemini key (AI features, optional locally)                     |
| `ENCRYPTION_KEY`      | ✅       | 32-byte hex key for AES-256-GCM BYOK encryption                       |
| `GEMINI_MODEL`        | ✅       | Model name e.g. `gemini-2.0-flash`                                    |
| `AI_DAILY_CAP_SHARED` | ✅       | Max AI calls/user/day on shared key (default `10`)                    |
| `NEXTAUTH_URL`        | ⚠️       | Required for local development: `http://localhost:3000`               |

> **Important:** The `MONGODB_URI` should point to your Atlas cluster. The code forces `dbName: 'Lockin'` so your data always lives in the `Lockin` database, not `test`.

### 3. Run Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

### 4. Verify Everything

```bash
pnpm verify   # lint + typecheck + unit tests + build
```

---

## 🧪 Testing

```bash
pnpm test            # Vitest unit tests (planning engine, auth, env, rate limiting)
pnpm test --watch    # Watch mode
```

Unit tests cover the pure planning engine (`calculateMissionHealth`, `calculateDayCapacity`, `previewRollover`), auth schema validation, bcrypt hashing, env validation, and rate-limit logic.

Playwright e2e tests run in Phase 5 (full signup → brain dump → runway → complete flow).

---

## 🚀 Deployment (Vercel)

1. Push branch, open PR → CI runs automatically
2. Connect GitHub repo to Vercel
3. Set **all env variables** from `.env.example` in Vercel dashboard
4. Set function region to `sin1` (Singapore) or `bom1` (Mumbai) to co-locate with Atlas
5. Deploy - Vercel auto-detects Next.js and sets the build command

**Vercel settings:**

- Build command: `pnpm build`
- Install command: `pnpm install --frozen-lockfile && pnpm approve-builds --all`
- Output directory: `.next`

---

## 📜 Available Scripts

| Script              | Description                                 |
| ------------------- | ------------------------------------------- |
| `pnpm dev`          | Start development server                    |
| `pnpm build`        | Production build                            |
| `pnpm start`        | Start production server                     |
| `pnpm lint`         | Next.js ESLint check                        |
| `pnpm typecheck`    | TypeScript strict type check                |
| `pnpm test`         | Vitest unit tests                           |
| `pnpm verify`       | All checks: lint + typecheck + test + build |
| `pnpm format:write` | Prettier format all files                   |

---

## 🔐 Security Notes

- Signup/login endpoints rate-limited: max 5 attempts per 10 minutes per email
- Generic error messages on auth failures to prevent enumeration
- Passwords: bcryptjs cost 12, min 8 chars, email normalized to lowercase
- BYOK Gemini API keys stored AES-256-GCM encrypted with `ENCRYPTION_KEY`
- AI calls: max 10/day (shared key) or 100/day (own key), tracked in `aiUsage` collection
- Committed secrets are rejected by the `commit-msg` hook - no `Co-authored-by`, `Generated with`, or AI signatures

---

## 📄 License

MIT © Dulsara Manakal
