# WholeFood RX

Inverse-lookup nutrition tool. Pick a micronutrient — get the highest-density whole-food sources, ranked per 100 g and per realistic serving. Science-forward, USDA/NIH-cited, no supplement-industry hype.

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind v4 + shadcn/ui (Radix primitives)
- Neon serverless Postgres + Drizzle ORM
- USDA FoodData Central API for vitamin/mineral/amino-acid/fatty-acid data
- Curated JSON (peer-reviewed citations) for adaptogens + phytonutrients

## Prerequisites

- Node 20+ and `pnpm`
- A Neon Postgres database (free tier): https://console.neon.tech
- A USDA FoodData Central API key (free): https://fdc.nal.usda.gov/api-key-signup.html

## Setup

1. Copy the env template and fill in real values:
   ```powershell
   Copy-Item .env.example .env.local
   ```
   Edit `.env.local`:
   - `DATABASE_URL` — your Neon connection string
   - `USDA_API_KEY` — your USDA FDC key

2. Install dependencies:
   ```powershell
   pnpm install
   ```

3. Apply the database schema:
   ```powershell
   pnpm db:migrate
   ```

4. Seed the database (pulls ~400 foods from the USDA API — takes a few minutes):
   ```powershell
   pnpm db:seed
   ```

5. Run the dev server:
   ```powershell
   pnpm dev
   ```
   Open http://localhost:3000

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Start the Next.js dev server |
| `pnpm build` | Production build |
| `pnpm start` | Run the production build |
| `pnpm test` | Run the Vitest unit tests |
| `pnpm db:generate` | Generate a Drizzle migration from `src/lib/schema.ts` |
| `pnpm db:migrate` | Apply migrations to the database |
| `pnpm db:seed` | Run all five seed scripts (nutrients, USDA foods, curated, symptoms, interactions) |

## Refreshing USDA data

Re-run `pnpm db:seed` — every seed script is idempotent (upsert / delete-then-insert), so re-running refreshes values in place without creating duplicates.

To regenerate the curated USDA food ID list from the current Foundation Foods dataset:
```powershell
pnpm tsx scripts/list-foundation-foods.ts
pnpm tsx scripts/build-food-ids.ts
```

## Project layout

- `src/app/` — Next.js routes (App Router). `/nutrient/[slug]` is the Nutrient → Food ranking view.
- `src/lib/` — Drizzle schema, DB client, queries, helpers (`slug`, `rda`, `usda-mapping`).
- `src/components/` — UI components (`ui/` holds shadcn primitives).
- `src/data/` — curated JSON source data.
- `scripts/` — migration and seed scripts.
- `drizzle/` — generated SQL migrations.
- `docs/plans/` — design spec and implementation plan.
- `tests/` — Vitest unit tests.

## Data sources & citations

Every numeric value in the UI links to its source: a USDA FoodData Central food-detail page for USDA-sourced rows, or a PubMed / NIH ODS citation for curated adaptogen/phytonutrient rows. RDA values are from NIH Office of Dietary Supplements fact sheets (adults 19–50).

## Status

MVP slice complete: Feature #1 (Nutrient → Food ranking). Features #2–5 (Food → Nutrient profile, Symptom chain, Plate builder, Synergy notes) and Vercel deployment are scoped in `docs/plans/` for the next phase.
