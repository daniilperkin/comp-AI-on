# GEMINI.md — Guidance for Gemini

> This file provides Gemini-specific instructions for working on comp[AI]on.
> Read AGENTS.md first for full project conventions.

## When You Are Working on This Project

### Strengths to Leverage
- **Large context window**: You can hold the entire backend + frontend codebase in context. Use this to understand cross-file dependencies before making changes.
- **Multimodal capability**: If screenshots of the UI are provided, analyze them for layout/styling issues.
- **Code generation**: You're good at generating boilerplate for new endpoints, components, and pages — follow the existing patterns closely.

### Workflow Preferences for Gemini
1. Read `AGENTS.md` fully before making any changes.
2. When adding a new endpoint, check `backend/routers/` for the existing pattern and follow it exactly.
3. When adding a new frontend page, check `src/App.tsx` for the routing pattern and `src/pages/` for page structure.
4. Always mirror backend model changes in `frontend/src/types.ts`.
5. After frontend changes, verify with `npm run build` (TypeScript strict mode).
6. After backend changes, verify by starting the server and testing endpoints.

### Things Gemini Should Watch For
- **SQLModel trap**: NEVER create `class FooCreate(Foo, table=True)` — use the base-class pattern. This is the #1 bug source.
- The folder name `comp[AI]on` has brackets — always use `-LiteralPath` with PowerShell cmdlets (Test-Path, Set-Location, etc.).
- `PYTHONPATH` must be set to the repo root when running uvicorn directly.
- Frontend uses `@/` path alias for `src/` imports — never use relative paths like `../../components`.
- All API calls go through `src/lib/api.ts` — never use `fetch()` directly in components.
- The app supports both light and dark themes via a ThemeProvider with system-theme detection and localStorage persistence.
- No comments in code unless explicitly requested.

### Code Style for Gemini
- Python: absolute imports (`from backend.models import ...`), no relative imports.
- TypeScript: strict mode, no `any` types, no unused vars.
- React: functional components with hooks only, no class components.
- Styling: Tailwind utility classes in JSX, use `cn()` for conditional classes.
- Components: use `class-variance-authority` for variants, `forwardRef` for UI primitives.

### Pattern Reference

**Backend endpoint pattern:**
```python
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from backend.db import get_session
from backend.models import MyModel, MyModelCreate

router = APIRouter(prefix="/api/myresource", tags=["myresource"])

@router.get("")
def list_items(session: Session = Depends(get_session)):
    return session.exec(select(MyModel)).all()

@router.post("", status_code=201)
def create_item(payload: MyModelCreate, session: Session = Depends(get_session)):
    entry = MyModel(**payload.model_dump())
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry
```

**Frontend page pattern:**
```tsx
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function MyPage() {
  const [data, setData] = useState([]);

  useEffect(() => {
    api.get("/myresource").then(setData);
  }, []);

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">My Page</h1>
      {/* content */}
    </div>
  );
}
```

### When Unsure
- Read `AGENTS.md` for canonical conventions.
- Read `backend/AGENTS.md` before touching backend code.
- Read `frontend/AGENTS.md` before touching frontend code.
