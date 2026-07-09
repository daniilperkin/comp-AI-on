# CLAUDE.md — Guidance for Claude

> This file provides Claude-specific instructions for working on comp[AI]on.
> Read AGENTS.md first for full project conventions.

## When You Are Working on This Project

### Strengths to Leverage
- **Careful, surgical edits**: Use the Edit tool for targeted changes. Never rewrite a whole file when a small change suffices.
- **Type safety**: You're good at TypeScript — ensure all new code passes `tsc` strict mode.
- **Architecture reasoning**: Think through the implications of schema changes before making them.

### Workflow Preferences for Claude
1. Always read the file before editing it.
2. Run `npm run build` after frontend changes to catch type errors.
3. Test backend changes by starting the server and hitting endpoints with `Invoke-WebRequest`.
4. Prefer the base-class SQLModel pattern — never create table=True subclasses of existing tables.
5. When adding new types, mirror them in both `backend/models.py` and `frontend/src/types.ts`.

### Things Claude Should Watch For
- The folder name `comp[AI]on` has brackets — use `-LiteralPath` with PowerShell cmdlets.
- `PYTHONPATH` must be set when running uvicorn directly.
- Frontend uses `@/` path alias for `src/` imports.
- All API calls go through `src/lib/api.ts` — never use `fetch()` directly in components.
- Dark mode is the only mode — don't add light mode toggles.

### Code Style for Claude
- No comments unless explicitly requested.
- Use `cn()` from `@/lib/utils` for conditional Tailwind classes.
- Functional components only, with hooks.
- Use `class-variance-authority` for component variants.
- Python: absolute imports, no relative imports.

### When Unsure
- Read `AGENTS.md` for canonical conventions.
- Read `backend/AGENTS.md` before touching backend code.
- Read `frontend/AGENTS.md` before touching frontend code.
