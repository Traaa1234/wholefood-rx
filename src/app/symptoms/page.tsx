import { Suspense } from 'react';
import Link from 'next/link';
import { listSymptoms, getNutrientsForSymptoms, rankFoodsByNutrient } from '@/lib/queries';
import { SymptomSelector } from '@/components/symptom-selector';

export const dynamic = 'force-dynamic';

export default async function SymptomsPage({
  searchParams,
}: { searchParams: Promise<{ s?: string | string[] }> }) {
  const sp = await searchParams;
  const selected = sp.s === undefined ? [] : Array.isArray(sp.s) ? sp.s : [sp.s];

  const symptoms = await listSymptoms();
  const nutrients = await getNutrientsForSymptoms(selected);

  const topNutrients = nutrients.slice(0, 6);
  const foodsByNutrient = await Promise.all(
    topNutrients.map((n) => rankFoodsByNutrient(n.nutrient_slug, 'per_serving', null, 3)),
  );

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Symptom finder</h1>
      <p className="mt-2 text-slate-600">
        Select what you're experiencing. We surface the micronutrients most associated with
        those symptoms, then the whole foods richest in each. Not medical advice — see a
        clinician for persistent symptoms.
      </p>

      <div className="mt-6">
        <Suspense fallback={<div className="h-9" />}>
          <SymptomSelector symptoms={symptoms} />
        </Suspense>
      </div>

      {selected.length === 0 && (
        <p className="mt-10 text-center text-sm text-slate-500">
          Pick one or more symptoms above to see suggested nutrients.
        </p>
      )}

      {selected.length > 0 && nutrients.length === 0 && (
        <p className="mt-10 text-center text-sm text-slate-500">
          No nutrient associations found for that selection.
        </p>
      )}

      {topNutrients.length > 0 && (
        <div className="mt-10 space-y-8">
          {topNutrients.map((n, i) => (
            <section key={n.nutrient_slug}>
              <div className="flex items-baseline justify-between">
                <Link href={`/nutrient/${n.nutrient_slug}`} className="text-lg font-medium hover:underline">
                  {n.nutrient_name}
                </Link>
                <span className="text-xs text-slate-400">
                  evidence weight {n.total_strength} · {n.symptom_count} of your symptoms
                </span>
              </div>
              <ul className="mt-2">
                {foodsByNutrient[i].map((f) => (
                  <li key={f.food_slug} className="flex justify-between border-b border-slate-100 py-1.5 text-sm">
                    <Link href={`/food/${f.food_slug}`} className="hover:underline">{f.food_name}</Link>
                    <span className="font-mono text-slate-600">
                      {Number(f.amount_per_serving).toLocaleString(undefined, { maximumFractionDigits: 2 })} {n.unit} / serving
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <p className="mt-10 text-xs text-slate-400">
        Nutrient–symptom associations are evidence-weighted (1–5) from the curated dataset.
        Educational tool, not a diagnosis.
      </p>
    </main>
  );
}
