# frontend/AGENTS.md — Frontend Guide

> Read the root `AGENTS.md` first for project-wide conventions.
> This file covers frontend-specific patterns and tasks.

## Quick Reference

| Task | Where to look |
|---|---|
| Add a new page | `src/pages/MyPage.tsx` + route in `App.tsx` + nav entry |
| Add a UI primitive | `src/components/ui/mycomponent.tsx` — use `cn()`, `forwardRef` |
| Add a feature component | `src/components/MyComponent.tsx` |
| Add a type | `src/types.ts` — mirror backend `models.py` |
| Make an API call | `src/lib/api.ts` — use `api.get/post/patch/put/delete` |
| Change theme | `src/index.css` CSS variables + `tailwind.config.js` |
| Add a chart | Use `recharts` — see Analytics page pattern |

## Architecture

```
frontend/
├── index.html              # HTML entry, dark class on <html> and <body>
├── package.json
├── vite.config.ts          # Vite config + /api proxy to localhost:8765
├── tsconfig.json           # Strict mode, @/ path alias
├── tsconfig.node.json      # Node TS config (composite: true)
├── tailwind.config.js      # Dark mode: class, content globs, theme extends
├── postcss.config.js
├── public/
│   └── favicon.svg
└── src/
    ├── main.tsx             # React entry + BrowserRouter (future flags on)
    ├── App.tsx              # Router + sidebar layout + nav
    ├── index.css            # Tailwind directives + CSS vars (dark theme)
    ├── types.ts             # TS interfaces mirroring backend models
    ├── vite-env.d.ts
    ├── lib/
    │   ├── api.ts           # Fetch wrapper (get/post/patch/put/delete)
    │   └── utils.ts          # cn(), formatDate(), formatDateShort()
    ├── components/
    │   ├── ui/              # shadcn-style primitives
    │   │   ├── button.tsx
    │   │   ├── input.tsx
    │   │   ├── label.tsx
    │   │   ├── textarea.tsx
    │   │   ├── select.tsx
    │   │   ├── card.tsx
    │   │   ├── badge.tsx
    │   │   └── table.tsx
    │   ├── StatCard.tsx
    │   ├── QuickAddBar.tsx   # Exports useModelsCategories hook
    │   ├── LogForm.tsx       # Full create/edit form
    │   └── LogTable.tsx      # Reusable log entry table
    └── pages/
        ├── Analytics.tsx
        ├── Compare.tsx
        ├── Dashboard.tsx
        ├── History.tsx
        ├── Log.tsx
        ├── Models.tsx
        ├── NotFound.tsx
        ├── Recommender.tsx
        └── Settings.tsx
```

## Path Alias

Use `@/` for all `src/` imports:
```tsx
// CORRECT
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

// WRONG
import { Button } from "../../components/ui/button";
```

## API Client

All HTTP calls go through `src/lib/api.ts`:
```tsx
import { api } from "@/lib/api";

// GET
const models = await api.get<Model[]>("/models");

// POST
const entry = await api.post<LogEntry>("/logs", { model_id: 1, quality_score: 8 });

// PATCH
await api.patch<LogEntry>(`/logs/${id}`, { quality_score: 9 });

// PUT
await api.put("/settings", { reminder_time: "19:30" });

// DELETE
await api.delete(`/logs/${id}`);
```

**Never** use `fetch()` directly in components — always go through `api`.

## UI Primitives

Hand-written shadcn-style components in `src/components/ui/`. Each uses:
- `forwardRef` for ref forwarding
- `cn()` from `@/lib/utils` for class merging
- `class-variance-authority` for variant props (where applicable)

### Pattern for a new UI primitive:
```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export const MyComponent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("base-classes", className)}
    {...props}
  />
));
MyComponent.displayName = "MyComponent";
```

## Theme / Styling

- **Dark mode only** — `class="dark"` on `<html>` and `<body>`
- CSS variables in `src/index.css` under `:root`
- High-contrast palette:
  - Background: `hsl(222 47% 11%)` — deep navy
  - Primary: `hsl(199 89% 48%)` — bright sky blue
  - Card: `hsl(222 47% 14%)` — slightly lighter navy
  - Border: `hsl(217 33% 24%)` — muted blue-gray
- Border radius: `--radius: 0.5rem`
- Tailwind config extends colors to use CSS vars: `bg-background`, `text-foreground`, `bg-card`, `text-primary`, etc.

## Adding a New Page

1. Create `src/pages/MyPage.tsx`:
   ```tsx
   export default function MyPage() {
     return (
       <div className="space-y-6 p-6">
         <h1 className="text-2xl font-bold">My Page</h1>
       </div>
     );
   }
   ```
2. Add route in `src/App.tsx`:
   ```tsx
   import MyPage from "@/pages/MyPage";
   // ...
   <Route path="/my-page" element={<MyPage />} />
   ```
3. Add nav entry in the `nav` array in `src/App.tsx`:
   ```tsx
   { to: "/my-page", label: "My Page", icon: SomeIcon },
   ```

## Shared Hooks

### `useModelsCategories()` (from `QuickAddBar.tsx`)
Fetches models and categories on mount. Returns `{ models, categories, setModels, setCategories }`.
```tsx
import { useModelsCategories } from "@/components/QuickAddBar";
const { models, categories } = useModelsCategories();
```

## Charts (recharts)

Recharts is installed. Pattern:
```tsx
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

<ResponsiveContainer width="100%" height={300}>
  <BarChart data={data}>
    <XAxis dataKey="name" />
    <YAxis />
    <Tooltip />
    <Bar dataKey="value" fill="hsl(var(--primary))" />
  </BarChart>
</ResponsiveContainer>
```

Use CSS variables (`hsl(var(--primary))`) for chart colors so they match the theme.

## TypeScript Strictness

- `strict: true` in `tsconfig.json`
- `noUnusedLocals: true` — no unused variables
- `noUnusedParameters: true` — no unused function params
- No `any` types — always define interfaces in `types.ts`

Always run `npm run build` to verify — it runs `tsc -b` before `vite build`.

## Vite Proxy

In dev mode, Vite proxies `/api/*` to `http://localhost:8765`:
```ts
// vite.config.ts
server: {
  proxy: {
    "/api": {
      target: "http://localhost:8765",
      changeOrigin: true,
    },
  },
}
```

Frontend code uses relative paths (`/api/logs`) — never hardcode `localhost:8765`.

## Build

```bash
npm run build    # tsc -b && vite build
npm run dev      # vite dev server (port 6769)
npm run preview  # preview production build
```

## Build Artifacts

`vite.config.js` and `vite.config.d.ts` are generated by `tsc -b`. They are gitignored — do not commit them.
