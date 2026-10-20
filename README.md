<img src="public/logo.svg" alt="Lockin" height="48" />

# Lockin - Mission-Driven Work Planning (v1.0.0)

> **Turn big initiatives into an sequenced pipeline of days.**  
> Lockin is a dark-first, mission-driven work planning and execution platform that breaks complex projects into sequenced daily lanes - with workload capacity forecasting, versioned runways, 24-hour day focus clocks, zero-latency drag-and-drop kanbans, full-screen lock-in focus timers, and Gemini-powered planning and feasibility re-planning.

[![CI](https://github.com/dulsara30/Lockin/actions/workflows/ci.yml/badge.svg)](https://github.com/dulsara30/Lockin/actions/workflows/ci.yml)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![MongoDB Atlas](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb)](https://www.mongodb.com/atlas)
[![License: MIT](https://img.shields.io/badge/License-MIT-violet.svg)](LICENSE)

---

## ✨ Features

### 🎯 Mission Control

- Define high-stakes initiatives with title, description, color, priority, tags, target deadlines, and day counts.
- Real-time mission health badge: **On track / At risk / Behind / Completed**, calculated dynamically from remaining task estimates versus scheduled capacity.
- Cascade deletion, archive/restore workflows, and user-scoped data access.

### 🚀 Runway View - Multi-Day Pipeline

- Visual day columns connected along an interactive sprint runway.
- **Finished days** glow lime, **today** is highlighted in violet, and **overloaded days** turn amber.
- Drag steps between days or reorder within a day using fractional indexing (`fractional-indexing`).
- Per-day capacity meters showing planned hours vs daily work limits.
- Instant modal and inline step creation per day lane.

### 🔀 Versioned Runways & AI Re-planning

- **Preserved History:** The original runway (v1) is permanently archived and never overwritten.
- **AI Feasibility Engine:** Analyzes remaining workload, overdue days, and remaining deadline days.
- **Overwork & Extra Days Calculation:** Identifies whether remaining tasks can fit within regular hours or calculates exact overwork hours/day and extra calendar days needed.
- **Version Branching:** Automatically branches into a new active version (e.g., v2, v3) with one-click version switching.

### ⏱️ Day Focus & 24-Hour Commitment Clock

- Dedicated daily execution view (`/runway/day/[dayIndex]`) organized into 5 status columns: `todo`, `in_progress`, `done`, `blocked`, and `skipped`.
- **Start Day Confirmation Modal:** Prevents accidental clock activation.
- **24-Hour Countdown Timer:** Displays exact hours and minutes remaining. If unfinished after 24 hours, the day triggers an overdue penalty warning and signals a need for runway re-planning.
- **Optimistic Drag & Drop:** Zero-latency task status transitions with automatic server synchronization and rollback on error.

### ⚡ Lock-In Mode

- Full-screen distraction-free focus workspace for individual steps.
- Monospace focus timer (start / pause / stop) logging sessions to `timeLogs`.
- Tracks actual versus estimated duration; updates `actualMin` upon session completion.
- Keyboard-accessible and respects `prefers-reduced-motion`.

### 🤖 AI Brain Dump & Structured Templates

- **AI Brain Dump:** Transform raw notes and unstructured briefs into sequenced, day-by-day execution plans using Google Gemini (`@google/genai`).
- **Template System:** Download and import Markdown or JSON sprint templates for offline or external LLM workflows without consuming AI tokens.
- **Shared Interactive Preview:** Review, customize, and edit steps before committing to the database.

### 📊 Insights & Analytics

- Visual burndown charts, planned vs actual duration comparisons, completion rates, and streak counters.
- Per-mission progress rings and historical activity logs.

### 🧭 "How It Works" Interactive Guide

- Dedicated in-app guide (`/how-it-works`) breaking down the 4-level data hierarchy (`Mission` → `Runway` → `Day` → `Step`), core feature mechanisms, system rules, and step-by-step operator workflows.

---

## 🗂️ Project Structure

```
src/
├── app/                   # Next.js App Router routes
│   ├── (app)/             # Authenticated route group with sidebar layout
│   │   ├── today/         # Daily unified dashboard
│   │   ├── missions/      # Mission management & creation
│   │   ├── runway/        # Runway pipeline & day focus (/runway/day/[dayIndex])
│   │   ├── lockin/        # Full-screen lock-in focus mode
│   │   ├── insights/      # Analytics & velocity charts
│   │   ├── templates/     # Sprint templates & manual imports
│   │   ├── settings/      # Account settings & BYOK API keys
│   │   └── how-it-works/  # Interactive platform architecture guide
│   ├── api/
│   │   ├── auth/          # Auth.js route handlers
│   │   └── health/        # Health check endpoint
│   ├── login/             # Authentication login
│   └── signup/            # User registration
│
├── features/              # Feature-sliced components and server actions
│   ├── auth/              # Auth forms and credentials handlers
│   ├── missions/          # Mission CRUD, validation schemas, actions
│   ├── runway/            # Runway pipelines, day view, dnd logic, actions
│   ├── steps/             # Step drawer, checklists, time logging
│   ├── today/             # Today dashboard and next-up widgets
│   ├── lockin/            # Focus timer and session recorder
│   ├── planner/           # AI Brain Dump and template parser
│   ├── insights/          # Burndown and velocity analytics
│   └── guide/             # How It Works interactive visualizer
│
├── server/
│   ├── models/            # Mongoose schemas (User, Mission, Runway, Step, TimeLog, Activity)
│   └── dal/               # Scoped data-access layer (all require userId)
│       ├── missions.ts
│       ├── runways.ts
│       ├── steps.ts
│       ├── timeLogs.ts
│       ├── activities.ts
│       └── today.ts
│
├── lib/                   # Core platform utilities
│   ├── db.ts              # Cached Mongoose connection (dbName: Lockin)
│   ├── auth.ts            # Auth.js v5 credentials configuration
│   ├── auth.config.ts     # Edge-compatible auth rules
│   ├── env.ts             # Zod environment validation
│   ├── planning.ts        # Pure health, capacity, and rollover engine
│   ├── ratelimit.ts       # MongoDB TTL rate limiting
│   └── utils.ts           # Styling and formatting helpers
│
└── middleware.ts          # Route protection and session validation
```

---

## 🛠️ Tech Stack

| Layer         | Technology                                       |
| ------------- | ------------------------------------------------ |
| Framework     | Next.js 15 (App Router, RSC, Server Actions)     |
| Language      | TypeScript 5 (Strict Mode)                       |
| Styling       | Tailwind CSS 3 + Radix UI + Custom Design Tokens |
| Drag & Drop   | `@dnd-kit/core` + `@dnd-kit/sortable`            |
| Indexing      | `fractional-indexing` (order strings)            |
| State & Cache | TanStack Query v5 + Optimistic UI Updates        |
| Forms         | React Hook Form + Zod                            |
| Animation     | Framer Motion                                    |
| Database      | MongoDB Atlas via Mongoose 8                     |
| Auth          | Auth.js v5 (NextAuth Credentials)                |
| Passwords     | bcryptjs (cost 12)                               |
| AI Engine     | Google Gemini via `@google/genai`                |
| Charts        | Recharts                                         |
| Testing       | Vitest (Unit) + Playwright (E2E)                 |
| Quality       | ESLint + Prettier + Husky + Commitlint           |
| Deployment    | Vercel (`sin1` / `bom1`)                         |

---

## ⚙️ Setup & Development

### Prerequisites

- Node.js 22+
- pnpm 9+
- MongoDB Atlas cluster
- Google Gemini API key (optional for local testing; BYOK supported)

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/dulsara30/Lockin.git
cd Lockin
pnpm install
```

### 2. Configure Environment Variables

```bash
cp .env.example .env.local
```

Populate `.env.local` with your credentials:

| Variable              | Required | Description                                                       |
| --------------------- | -------- | ----------------------------------------------------------------- |
| `MONGODB_URI`         | ✅       | MongoDB Atlas connection URI (database enforced as `Lockin`)      |
| `AUTH_SECRET`         | ✅       | Secure 32+ byte string for JWT token encryption                   |
| `GEMINI_API_KEY`      | ⚠️       | Shared Google Gemini API key for AI Brain Dump & Re-planning      |
| `ENCRYPTION_KEY`      | ✅       | 32-byte hex key for encrypting user BYOK API keys (AES-256-GCM)   |
| `GEMINI_MODEL`        | ✅       | Default model ID (e.g. `gemini-2.5-flash`)                        |
| `AI_DAILY_CAP_SHARED` | ✅       | Max daily AI operations per user on shared key (default: `10`)    |
| `NEXTAUTH_URL`        | ⚠️       | Base application URL (e.g. `http://localhost:3000` for local dev) |

### 3. Run Development Server

```bash
pnpm dev
```

Navigate to [http://localhost:3000](http://localhost:3000).

---

## 🧪 Testing & Verification

Run the comprehensive single-command verification suite:

```bash
pnpm verify
```

This runs:

1. `pnpm lint`: ESLint static analysis
2. `pnpm typecheck`: Strict TypeScript typecheck (`tsc --noEmit`)
3. `pnpm test`: Vitest unit tests for the planning engine, security, and schemas
4. `pnpm build`: Next.js production build

### E2E Testing (Playwright)

```bash
pnpm exec playwright test
```

---

## 🔒 Security Architecture

- **Scoped Queries:** Every database query executes through the Data-Access Layer (`src/server/dal/`) and strictly requires `userId`. Queries by document ID alone are strictly rejected.
- **Server-Side Validation:** All Server Actions validate inputs with Zod schemas before running business logic.
- **Zero Raw HTML:** Markdown notes and text render strictly through sanitized markdown components.
- **Rate Limiting:** Auth endpoints and AI operations are protected via MongoDB TTL index rate limiters.
- **AES-256-GCM BYOK Encryption:** User-supplied Gemini keys are encrypted at rest with authenticated encryption.
- **Git Commit Verification:** Husky `commit-msg` hooks enforce Conventional Commits and reject unauthorized agent signatures.

---

## 🚀 Deployment

1. Push your branch and open a Pull Request.
2. Connect your GitHub repository to Vercel.
3. Add all production environment variables from `.env.example` in the Vercel dashboard.
4. Set Node.js version to `22.x` and region close to your database (e.g., `sin1` or `bom1`).
5. Deploy. Build and start commands are detected automatically.

---

## 📄 License

MIT © Dulsara Manakal
