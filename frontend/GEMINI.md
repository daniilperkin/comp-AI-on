# GEMINI.md — comp[AI]on Frontend

> **Single source of truth: [`AGENTS.md`](./AGENTS.md) and root [`../AGENTS.md`](../AGENTS.md).**
> This file is a bridge for Gemini/Antigravity agents. Read both AGENTS.md files for the full project guide.

## Quick summary for Antigravity

| Topic | Key info |
|---|---|
| **Stack** | React 18, Vite, TypeScript (strict), Tailwind CSS 3, shadcn/ui |
| **Setup** | `npm install` in this directory |
| **Dev server** | `npm run dev` (port 6769, proxies `/api` to `localhost:8765`) |
| **Verify** | `npm run build` (TypeScript check + Vite production build) |
| **Path alias** | `@/` maps to `src/` — never use relative paths like `../../components` |
| **API client** | All calls go through `@/lib/api.ts` — never `fetch()` directly in components |
| **Theme** | Dark mode via Tailwind `class` strategy; ThemeProvider with `useTheme()` |

## comp[AI]on-specific gotchas

- **The repo name `comp[AI]on` has brackets** — PowerShell commands need `-LiteralPath` (or it misinterprets `[AI]` as a wildcard).
- Never create a SQLModel with `table=True` on Create/Update schemas — this is the #1 bug source.
- Always verify with `npm run build` after frontend changes.