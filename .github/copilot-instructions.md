# Copilot Instructions — BxMO

## Build & Run

```bash
npm run dev          # Dev server at localhost:4321
npm run build        # Static build to dist/
npm run lint         # ESLint + Prettier check
npm run format       # Auto-fix lint + format issues
```

Lint is `eslint . && prettier --check .` — run `npm run format` to auto-fix.

## CLI Tools

Import a new edition from CSV:

```bash
node cli/import.mjs --year 2026 --location "City" --country nld \
  --bronze 10 --silver 15 --gold 20 --csv results.csv
```

Validate all data files (checks YAML structure, score ranges 0–7, country/language codes, PDF existence, threshold ordering):

```bash
node cli/validate.mjs
```

## Architecture

This is a **static Astro site** — all pages are pre-rendered at build time via `getStaticPaths()`. Zero JavaScript is shipped to the client except for Chart.js on results pages and client-side search on the search page.

### Data flow

1. **YAML files** in `data/editions/{year}.yaml` store per-edition results, delegations, and metadata. Reference data lives in `data/countries.yaml` and `data/languages.yaml`.
2. **`src/lib/data.ts`** loads and caches YAML data. All data access goes through this module. Key types: `Edition`, `Participant`, `Country`, `Language`, `Thresholds`.
3. **`src/lib/awards.ts`** computes medals from scores + thresholds at build time. Awards are never stored in YAML. Honourable mentions are given when a participant scores 7 on any single problem but doesn't earn a medal.
4. **`src/lib/stats.ts`** computes rankings (standard competition ranking), country statistics (quartiles, per-problem averages), and problem statistics (mean, median, stddev, histogram).
5. **Astro pages** in `src/pages/` combine these modules to render HTML. Dynamic routes use `[year]` params.

### Page routes

- `/` — edition listing grid
- `/edition/[year]` — edition info, problem PDFs, delegations
- `/results/[year]` — full results tables, medal summary, Chart.js visualizations
- `/results/[year].csv` — CSV export (also supports `all` for every edition combined)
- `/search` — client-side participant search across all years
- `/about` — rendered from `data/about.md`

## Conventions

- **Path aliases**: `@lib/*` → `src/lib/*`, `@components/*` → `src/components/*` (defined in `tsconfig.json`)
- **Formatting**: Prettier with single quotes, trailing commas, 2-space indent, 80 char width, `prettier-plugin-astro` for `.astro` files
- **Lint rules**: strict equality (`eqeqeq`), `prefer-const`, no `var`, no `any`, no `console.log` (except `warn`/`error`; `no-console` is off for CLI scripts). Unused args prefixed with `_` are allowed.
- **Country codes**: 3-letter lowercase (e.g., `bel`, `nld`, `lux`). Must exist in `data/countries.yaml`.
- **Scores**: Always an array of exactly 4 integers, each 0–7.
- **Thresholds**: Must satisfy `bronze ≤ silver ≤ gold`.
- **Styling**: CSS custom properties defined in `Layout.astro` (e.g., `--color-primary`, `--color-gold`). Scoped `<style>` blocks per page/component.
- **Site base path**: Deployed under `/bxmo` on GitHub Pages — `astro.config.mjs` sets `base: '/bxmo'`.

## Adding a New Edition

1. Run `cli/import.mjs` with CSV and medal thresholds
2. Edit the generated `data/editions/{year}.yaml` to add `info`, `problems`, and `delegations`
3. Add problem PDFs to `public/problems/` as `bxmo-problems-{year}-{lang}.pdf`
4. Run `node cli/validate.mjs && npm run build` to verify
