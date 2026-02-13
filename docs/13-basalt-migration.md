# 13. Basalt UI Migration

Migrate all noheir UI to the basalt design system (matte, 3-tier luminance, Sky primary).

## Principles

- **UI only** — domain, viewmodels, contexts, hooks, services are untouched.
- **Atomic commits** — one logical change per commit, every commit must pass tests.
- **No feature regression** — all 23 tabs, auth flow, data display must work identically.
- **3-layer test gate** — UT (`bun run test:unit`) after every commit, full suite before push.

## Source template

| Key | Value |
|-----|-------|
| Template | `../basalt` |
| Login template | `BadgeLoginPage` (not `LoginPage`) |
| Primary color | **Sky** — `200 90% 55%` (light) / `200 90% 60%` (dark) |
| Design language | Matte cards (`border-0 shadow-none bg-secondary`), 3-tier luminance (L0→L1→L2) |

## Tech delta

| Aspect | noheir (before) | basalt (target) | Migration |
|--------|----------------|-----------------|-----------|
| Tailwind | v3 + `tailwind.config.ts` + PostCSS | v4 + `@tailwindcss/vite` + `@theme inline` | Full rewrite of config |
| Fonts | Roboto / Libre Caslon Text / Roboto Mono | Inter / DM Sans | Replace Google Fonts imports |
| Primary | `219 43% 41%` (Logo Blue) | `200 90% 55%` (Sky) | CSS vars |
| Luminance | Flat (white card on slate bg) | 3-tier (L0 body → L1 card → L2 secondary) | CSS vars |
| Dark mode | Slate-based (`222 47% 11%`) | Neutral black (`0 0% 9%`) | CSS vars |
| Chart palette | 5 colors | 24 colors + heatmap scales | Extend |
| Layout | `children` prop, `bg-card` sidebar | `children` prop (keep), `bg-background` sidebar, `rounded-[20px] bg-card` content | Restyle |
| Login | Card-based full-screen primary bg | Badge card with radial glow | Replace component |

## Phases

### Phase 0 — Foundation (highest risk)

#### 0.1 Tailwind v3 → v4

1. Remove `tailwind.config.ts`, `postcss.config.js` (if exists), `autoprefixer` dev dep.
2. Uninstall `tailwindcss@3`, `tailwindcss-animate`, `postcss`, `autoprefixer`.
3. Install `tailwindcss@4`, `@tailwindcss/vite`, `tw-animate-css`.
4. Update `vite.config.ts` — add `@tailwindcss/vite` plugin.
5. Rewrite `src/index.css`:
   - `@import "tailwindcss"` + `@import "tw-animate-css"`
   - `@custom-variant dark (&:where(.dark, .dark *))`
   - `@theme inline { ... }` block with all `--color-*` mappings
6. Run UT → fix breakages.

#### 0.2 Font swap

1. Replace Google Fonts `@import` URLs: Inter + DM Sans (drop Roboto/Libre Caslon).
2. Update `body` font-family to `"Inter", system-ui, ...`.
3. Add `@utility font-display { font-family: "DM Sans", ... }`.
4. Run UT.

#### 0.3 Color palette — Sky primary

1. Set `--primary: 200 90% 55%` (light) / `200 90% 60%` (dark).
2. Adopt basalt 3-tier luminance:
   - L0 `--background: 220 14% 94%` → dark `0 0% 9%`
   - L1 `--card: 220 14% 97%` → dark `0 0% 10.6%`
   - L2 `--secondary: 0 0% 100%` → dark `0 0% 12.2%`
3. Expand chart palette from 5 → 24 colors (basalt values).
4. Add heatmap scales (green/red/blue/orange × 4 levels, HSL-based).
5. Add `--success`, `--badge-red`, `--chart-axis`, `--chart-muted`.
6. Add `--radius-card: 14px`, `--radius-widget: 10px`.
7. Preserve noheir-specific: `--income`, `--expense`, `--text-*`, `--bg-*`, `--primary-hover/light/dark`.
8. Create `src/lib/palette.ts` (basalt version + noheir financial semantics).
9. Run UT.

### Phase 1 — Layout

1. Restyle `DashboardLayout.tsx` to basalt visual:
   - Sidebar: `bg-background` (not `bg-card`), 260px/68px widths.
   - Content: `rounded-[16px] md:rounded-[20px] bg-card p-3 md:p-5`.
   - Header: 14px height, page title left, theme toggle right.
2. Add ⌘K command palette search.
3. Collapsed mode: icon-only with tooltips.
4. Mobile: overlay + backdrop-blur-xs.
5. Keep `children` prop architecture (noheir tab-based routing stays).
6. Run UT + visual check.

### Phase 2 — BadgeLogin

1. Create `BadgeLoginPage.tsx` adapted from basalt template.
2. Replace branding (Mountain → noheir logo, "basalt." → site name).
3. Wire Google OAuth via `useAuth().signInWithGoogle()`.
4. Preserve loading state, terms/privacy links.
5. Update `LoginPage.tsx` (or `Index.tsx` auth gate) to render `BadgeLoginPage`.
6. Run UT.

### Phase 3 — Page component visual unification

1. Global Card style: `border-0 shadow-none bg-secondary`.
2. StatCard → basalt matte style.
3. Chart containers → borderless card wrappers.
4. Tables/lists → basalt spacing + typography.
5. NotFound → basalt style (giant "404", bg-background).
6. LoadingPage → bg-background + radial glow.
7. Run UT after each page batch.

### Phase 4 — Component library alignment

1. ~~Update existing shadcn/ui components' default styles for v4 compatibility.~~ ✅
2. ~~Ensure all 50 noheir components work with new CSS variable system.~~ ✅
3. ~~Add `colored-badge.tsx` integration with new palette.~~ (Skipped — not needed)
4. ~~Migrate all `colorPalette.ts` consumers to `palette.ts`.~~ ✅ (7 files)
5. ~~Fix remaining hardcoded hex colors in ECharts components.~~ ✅ (LiquidityLadder, CapitalUnitsManager)
6. Run UT. ✅

### Phase 5 — Full validation

1. ~~`bun run test:unit` — 327 tests pass.~~ ✅
2. ~~`bun run lint` — 0 errors, 0 warnings.~~ ✅
3. ~~`bun run test:e2e` — 59 tests pass.~~ ✅
4. ~~`bun run test:mcp` — 168 tests pass.~~ ✅
5. ~~`bun run build` — clean production build.~~ ✅

## Rollback

Every phase is a sequence of atomic commits. To rollback any phase, `git revert` the range.

## Progress

| Phase | Status | Commit | Notes |
|-------|--------|--------|-------|
| 0.1 Tailwind v4 | ✅ Done | `0732c5d` | Removed v3 config, installed v4 + `@tailwindcss/vite` |
| 0.2 Font swap | ✅ Done | `d25c2b9` | Inter / DM Sans |
| 0.3 Color palette | ✅ Done | `32c1089` | Sky primary, 3-tier luminance, 24 chart colors, heatmaps |
| 1 Layout | ✅ Done | `cd4d491` | Basalt sidebar + rounded content area + ⌘K |
| 2 BadgeLogin | ✅ Done | `fad293a` | Badge card with radial glow, Google OAuth |
| 3 Page visual | ✅ Done | `f227a31` | Matte cards, LoadingPage, NotFound |
| 4.1 shadcn/ui fixes | ✅ Done | `d290bc7` | caret-blink, animation, toast, sidebar |
| 4.2 Palette resolver | ✅ Done | `4bc1607` | resolveColor, domain maps, 28 tests |
| 4.3 Consumer migration | ✅ Done | `cf61170` | 7 files migrated to palette.ts |
| 4.4 Hardcoded hex cleanup | ✅ Done | (this commit) | LiquidityLadder + CapitalUnitsManager |
| 5 Full validation | ✅ Done | — | 327 UT + lint + build + 59 E2E + 168 MCP |
