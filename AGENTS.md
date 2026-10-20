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
