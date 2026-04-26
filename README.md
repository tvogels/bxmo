# BxMO — Benelux Mathematical Olympiad

Static website for the Benelux Mathematical Olympiad results and statistics, built with [Astro](https://astro.build) and deployed via GitHub Pages.

## Quick Start

```bash
npm install
npm run dev      # Start dev server at localhost:4321
npm run build    # Build static site to dist/
npm run preview  # Preview built site locally
npm run lint     # Run ESLint + Prettier checks
```

## Adding a New Edition

### 1. Import results from CSV

Prepare a CSV file with columns: `no,country,fname,lname,mname,p1,p2,p3,p4`

```bash
node cli/import.mjs \
  --year 2026 \
  --location "City Name" \
  --country nld \
  --bronze 10 --silver 15 --gold 20 \
  --csv results.csv
```

### 2. Edit the generated YAML

Open `data/editions/2026.yaml` to add:

- `info`: Markdown description of the edition
- `problems`: List of language codes for available problem PDFs
- `delegations`: Country delegations with leaders and deputies

Run `npx prettier --write data/editions/2026.yaml`.

### 3. Add problem PDFs

Copy PDF files to `public/problems/` following the naming convention:
`bxmo-problems-{year}-{lang}.pdf`

### 4. Validate and commit

```bash
node cli/validate.mjs    # Check all data is valid
npm run build             # Verify the site builds
git add -A && git commit  # Commit and push
```

The CI pipeline will validate, build, and deploy automatically.

## Project Structure

```
├── .github/workflows/    # CI/CD (deploy + PR validation)
├── cli/
│   ├── import.mjs        # Import edition results from CSV
│   ├── validate.mjs      # Validate all data files
│   └── migrate-sql.mjs   # One-time migration from MySQL dump
├── data/
│   ├── countries.yaml    # Country list (code, names)
│   ├── languages.yaml    # Language list (code, names)
│   ├── about.md          # About page content
│   └── editions/         # One YAML file per edition year
│       ├── 2009.yaml
│       └── ...
├── public/
│   └── problems/         # Problem PDF files
├── src/
│   ├── components/       # Astro components (Layout)
│   ├── lib/              # TypeScript modules
│   │   ├── data.ts       # YAML data loader + types
│   │   ├── awards.ts     # Medal/award calculation
│   │   └── stats.ts      # Statistics (rankings, aggregates)
│   └── pages/            # Astro pages → static HTML
│       ├── index.astro
│       ├── about.astro
│       ├── search.astro
│       ├── results/[year].astro
│       ├── results/[year].csv.ts
│       └── edition/[year].astro
├── astro.config.mjs
├── eslint.config.js
└── tsconfig.json
```

## Data Format

Each edition is stored as a YAML file in `data/editions/`. Awards are **computed at build time** from scores and thresholds — they are not stored in the data files.

```yaml
year: 2025
location: Liège
country: bel
thresholds:
  bronze: 10
  silver: 14
  gold: 19
honourableMentions: true
info: |
  Edition description in Markdown.
problems:
  - lang: en
  - lang: fr
delegations:
  - country: bel
    leader: { fname: First, lname: Last }
    deputies:
      - { fname: First, lname: Last }
participants:
  - no: 1
    country: bel
    fname: First
    lname: Last
    scores: [7, 3, 5, 2]
```

## Technology

- **Astro** — static site generator (zero JS shipped by default)
- **TypeScript** — type-safe data handling
- **Chart.js** — interactive charts (loaded client-side only on results pages)
- **GitHub Actions** — CI/CD for deploy and validation
