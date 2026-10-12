---
version: alpha
name: comp[AI]on
description: Warm-neutral instrument-panel UI for a local AI usage dashboard. Dark-first, high contrast, one red accent reserved for destructive actions.
colors:
  background: "#121212"
  foreground: "#f8f6f1"
  card: "#1a1a1a"
  primary: "#f8f6f1"
  primary-foreground: "#121212"
  secondary: "#242424"
  muted: "#242424"
  muted-foreground: "#999999"
  accent: "#2b2b2b"
  accent-foreground: "#f8f6f1"
  destructive: "#dc2828"
  destructive-foreground: "#f8f6f1"
  border: "rgba(255, 255, 255, 0.08)"
  ring: "#f8f6f1"
  success: "#34d399"
  warning: "#fbbf24"
typography:
  display-num:
    fontFamily: JetBrains Mono Variable
    fontSize: 1.5rem
    fontWeight: 700
    lineHeight: 1.2
  h1:
    fontFamily: Inter
    fontSize: 1.5rem
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.5
  label-caps:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0.025em
  caption:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: 400
    lineHeight: 1.4
rounded:
  sm: 6px
  md: 8px
  lg: 10px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    height: 36px
    padding: 16px
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    height: 36px
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    height: 36px
  button-ghost-hover:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-foreground}"
    rounded: "{rounded.md}"
  button-destructive:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.destructive-foreground}"
    rounded: "{rounded.md}"
    height: 36px
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: 16px
  badge-success:
    backgroundColor: "rgba(52, 211, 153, 0.15)"
    textColor: "{colors.success}"
    rounded: "{rounded.md}"
  badge-warning:
    backgroundColor: "rgba(251, 191, 36, 0.15)"
    textColor: "{colors.warning}"
    rounded: "{rounded.md}"
  input:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    height: 36px
    padding: 12px
  label:
    textColor: "{colors.muted-foreground}"
    typography: "{typography.label-caps}"
  skeleton:
    backgroundColor: "{colors.muted}"
    rounded: "{rounded.md}"
---

## Overview

comp[AI]on is a local developer log and dashboard: a warm-neutral
"instrument panel". Matte dark surfaces, one warm off-white ink, one
red reserved for destructive actions. The mood is quiet and data-dense —
numbers are the decoration, not color.

Dark is the reference theme (all hex values above); light mirrors the
same tokens on warm limestone. Every component reads the CSS variables
from `src/index.css` — `class="dark"` on `<html>` flips the palette and
nothing else changes.

## Colors

The neutrals are deliberately split: surfaces and ink are *warm*
(hue 40, cream), mid-grays are plain neutral (hue 0). This is what
keeps the UI from looking like default Tailwind gray.

| Token | Dark (reference) | Light |
|---|---|---|
| background | `#121212` | `#f8f6f1` |
| foreground | `#f8f6f1` | `#1a1a1a` |
| card | `#1a1a1a` | `#fcfaf8` |
| primary | `#f8f6f1` | `#262626` |
| secondary / muted | `#242424` | `#edeae3` |
| muted-foreground | `#999999` | `#666666` |
| accent | `#2b2b2b` | `#e7e2da` |
| border | `rgba(255,255,255,.08)` | `rgba(0,0,0,.08)` |
| destructive | `#dc2828` | `#dc2828` |

- **Destructive red is the only saturated accent.** Do not introduce
  new accent hues.
- **Status colors** (badges only, always on a 15%-alpha tint):
  success = emerald (`#34d399` dark / `#047857` light),
  warning = amber (`#fbbf24` dark / `#b45309` light).
- Use the semantic Tailwind classes (`bg-background`, `text-foreground`,
  `border-border`, `bg-card`, `bg-primary`, `text-muted-foreground`, …) —
  never raw hex, and never Tailwind palette classes like `bg-zinc-800`.

## Typography

Two faces: **Inter** (300–700, loaded in `index.html`) for all text,
and **JetBrains Mono Variable** (self-hosted via `@fontsource-variable`)
for numbers. Any numeric readout uses `font-mono tabular-nums` so
digits never jitter while values animate.

- `h1` — page titles: `text-2xl font-bold`.
- `display-num` — stat-card values: `font-mono text-2xl font-bold tabular-nums`.
- `body-sm` — default UI text: buttons, inputs, tables, descriptions.
- `label-caps` — stat labels: `text-xs font-medium uppercase tracking-wide text-muted-foreground`.
- `caption` — hints and metadata: `text-xs text-muted-foreground`.

## Layout

4px base scale (Tailwind steps: 1 = 4px, 2 = 8px, 4 = 16px, 6 = 24px,
8 = 32px). Page shells use `p-6` with `space-y-6` between sections;
card interiors and grid gaps use 16–24px (`p-4`, `gap-4`, `gap-6`).
Sidebar + main content layout; stat grids are responsive 2–4 columns.

## Elevation & Depth

Depth comes from one-step-lighter surfaces plus the translucent 8%
border — not from heavy shadows. Shadows are always soft and barely
visible: `shadow-soft` at rest, `shadow-soft-md`/`shadow-soft-lg` for
hover lift (e.g. stat cards rise `-translate-y-1`). No colored or
high-opacity shadows.

## Shapes

Fully rounded corners, three steps: 10px cards (`rounded-lg`), 8px
controls and badges (`rounded-md`), 6px small elements (`rounded-sm`).
`rounded-full` only for dots/heatmap cells. No sharp corners.

## Components

- **Buttons** (`src/components/ui/button.tsx`): variants `default`
  (off-white on dark), `secondary`, `ghost`, `outline`, `destructive`,
  `link`. Height 36px default (`h-9`), 32px (`sm`), 40px (`lg`), square
  icon 36px. Hover steps one notch (`primary/90`, `secondary/80`; ghost
  and outline hover to `accent`); press is `active:scale-95`; focus is
  `ring-2 ring-ring`.
- **Cards** (`card.tsx`): `rounded-lg border-border bg-card shadow-soft`;
  header `p-4`, title `font-semibold tracking-tight`, description
  `text-sm text-muted-foreground`.
- **Badges** (`badge.tsx`): `text-xs font-medium rounded-md px-2 py-0.5`;
  default is a `primary/15` tint; `success`/`warning`/`destructive` use
  their 15%-alpha tint with the matching text color.
- **Inputs** (`input.tsx`): `h-9 rounded-md border-input bg-background
  px-3 text-sm`, focus `ring-1 ring-ring`, placeholder `muted-foreground`.

## Do's and Don'ts

**Do**

- Style with the semantic tokens — they switch with the theme for free.
- Charts (recharts): use CSS variables, e.g. `fill="hsl(var(--primary))"`.
- Format numbers and dates with the helpers in `@/lib/utils`
  (`formatCost`, `formatDate`, `formatDateShort`).
- Compose classes with `cn()`; variants with CVA; primitives with
  `forwardRef` — mirror `src/components/ui/`.
- Motion is opt-in and lives behind `html.motion` (Settings → Appearance,
  `companion-motion`): entrance effects use `[data-motion]` + the telemetry
  rules in `index.css` — transform/opacity/clip-path only,
  IntersectionObserver-driven, never scroll listeners; entrances stay
  ≤ 700ms with a 30–80ms stagger.

**Don't**

- No raw hex or Tailwind palette classes in components (the
  emerald/amber badge tints are the only sanctioned exception).
- No hand-written `useMemo`/`useCallback` and no components declared
  inside components — the React Compiler handles memoization and both
  are lint errors here.
- No `fetch()` outside `src/lib/api.ts`; no hardcoded `localhost:8765`.
- No new accent hues; destructive red is the only saturated color.
- No ad-hoc animations: new motion belongs to the opt-in telemetry
  language, not one-off keyframes or ungated hover movement.
- Never let dev-only tooling into production: `Agentation` and
  `ReactQueryDevtools` stay behind `import.meta.env.DEV`.
