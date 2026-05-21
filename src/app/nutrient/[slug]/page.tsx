import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getNutrient, rankFoodsByNutrient, getInteractionsForNutrient } from '@/lib/queries';
import { FoodRankRow } from '@/components/food-rank-row';
import { NutrientToggle } from '@/components/nutrient-toggle';
import { CategoryFilter } from '@/components/category-filter';
import { SynergyCard } from '@/components/synergy-card';

export const dynamic = 'force-dynamic';

type Params = { slug: string };
type Search = { basis?: string; category?: string };

export default async function NutrientPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const basis = (sp.basis === 'per_serving' ? 'per_serving' : 'per_100g') as
    | 'per_100g'
    | 'per_serving';
  const categoryFilter = sp.category ?? null;

  const nutrient = await getNutrient(slug);
  if (!nutrient) notFound();

  const rows = await rankFoodsByNutrient(slug, basis, categoryFilter, 25);
  const interactions = await getInteractionsForNutrient(slug);
  const rda = nutrient.rda_male ?? nutrient.rda_female ?? null;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/nutrient" className="text-xs text-slate-500 hover:text-slate-900">
        ← all nutrients
      </Link>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">{nutrient.name}</h1>

      <div className="mt-2 grid grid-cols-2 gap-4 text-sm text-slate-600 sm:grid-cols-4">
        <div>
          <div className="text-xs uppercase text-slate-400">RDA (M)</div>
          {nutrient.rda_male ?? '—'} {nutrient.unit}
        </div>
        <div>
          <div className="text-xs uppercase text-slate-400">RDA (F)</div>
          {nutrient.rda_female ?? '—'} {nutrient.unit}
        </div>
        <div>
          <div className="text-xs uppercase text-slate-400">Upper limit</div>
          {nutrient.toxicity_threshold ?? '—'}
        </div>
        <div>
          <div className="text-xs uppercase text-slate-400">Category</div>
          {nutrient.category.replace(/_/g, ' ')}
        </div>
      </div>

      {nutrient.function_summary && (
        <p className="mt-4 text-sm leading-relaxed text-slate-700">{nutrient.function_summary}</p>
      )}
      {nutrient.absorption_notes && (
        <p className="mt-2 text-xs italic text-slate-500">{nutrient.absorption_notes}</p>
      )}

      <div className="mt-8 flex items-center justify-between gap-4">
        <Suspense fallback={<div className="h-8 w-44 rounded-md border border-slate-200" />}>
          <NutrientToggle basis={basis} />
        </Suspense>
      </div>
      <div className="mt-3">
        <Suspense fallback={<div className="h-7" />}>
          <CategoryFilter active={categoryFilter} />
        </Suspense>
      </div>

      <ol className="mt-6">
        {rows.length === 0 && (
          <li className="py-8 text-center text-sm text-slate-500">
            No foods seeded for this nutrient yet.
          </li>
        )}
        {rows.map((r, i) => (
          <FoodRankRow
            key={`${r.food_slug}-${r.data_source}`}
            rank={i + 1}
            food_slug={r.food_slug}
            food_name={r.food_name}
            serving_description={r.serving_description}
            amount_per_100g={r.amount_per_100g}
            amount_per_serving={r.amount_per_serving}
            data_source={r.data_source}
            citation_url={r.citation_url}
            unit={nutrient.unit}
            rda={rda}
            basis={basis}
          />
        ))}
      </ol>

      <SynergyCard interactions={interactions} />

      <p className="mt-10 text-xs text-slate-400">
        Data: USDA FoodData Central (foundation + SR legacy) and curated peer-reviewed literature.
        RDAs from NIH ODS.
      </p>
    </main>
  );
}
