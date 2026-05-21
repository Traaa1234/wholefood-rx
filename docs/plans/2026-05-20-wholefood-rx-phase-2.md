# WholeFood RX — Phase 2 Plan (stub)

Status: not yet planned. To be brainstormed + planned in a future session.

The MVP slice (scaffold, schema, full seed pipeline, Feature #1 Nutrient → Food) is complete on `main`. Phase 2 covers the remaining features from the design spec (`2026-05-20-wholefood-rx-design.md`):

## Feature #2 — Food → Nutrient view
Route `/food/[slug]`. Radar chart of vitamins + bar chart of minerals for a single food, full micronutrient table beneath. Recharts is already installed.

## Feature #3 — Symptom → Nutrient → Food chain
Route `/symptoms`. Multi-select symptoms → ranked suggested nutrients (via `symptom_nutrients.strength`) → top food sources for each. Data already seeded (12 symptoms, 54 links).

## Feature #4 — Daily plate builder
Route `/plate`. Client component, `localStorage` persistence (no auth). Add foods to "today's plate", show cumulative %RDA across all nutrients, highlight gaps.

## Feature #5 — Synergy notes
Inline cards on `/nutrient/[slug]` and `/food/[slug]` surfacing `nutrient_interactions` (synergies, antagonists, cofactors). Data already seeded (14 interactions).

## Deployment
Deploy to Vercel. Set `DATABASE_URL` + `USDA_API_KEY` as Vercel env vars. Confirm the Neon serverless driver works in the Vercel runtime.

Each feature should get its own brainstorm → spec → plan cycle, or a single combined phase-2 plan if scope stays small.
