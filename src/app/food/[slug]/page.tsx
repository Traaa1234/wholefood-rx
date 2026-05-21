import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getFood, getFoodNutrientProfile } from '@/lib/queries';
import { pctRda } from '@/lib/rda';
import { NutrientRadarChart, type ChartDatum } from '@/components/nutrient-radar-chart';
import { NutrientBarChart } from '@/components/nutrient-bar-chart';
import { NutrientProfileTable } from '@/components/nutrient-profile-table';

export const dynamic = 'force-dynamic';

const VITAMIN_CATS = ['vitamin_fat_soluble', 'vitamin_water_soluble'];
const MINERAL_CATS = ['macro_mineral', 'trace_mineral'];

function shortLabel(name: string): string {
  return name.replace(/\s*\(.*\)\s*/, '').trim();
}

export default async function FoodPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const food = await getFood(slug);
  if (!food) notFound();

  const profile = await getFoodNutrientProfile(food.id);

  const toChart = (cats: string[]): ChartDatum[] =>
    profile
      .filter((r) => cats.includes(r.nutrient_category))
      .map((r) => {
        const pct = pctRda(r.amount_per_serving, r.rda_male ?? r.rda_female);
        return { label: shortLabel(r.nutrient_name), pct: pct === null ? 0 : Math.min(pct, 100) };
      })
      .filter((d) => d.pct > 0);

  const vitaminData = toChart(VITAMIN_CATS);
  const mineralData = toChart(MINERAL_CATS);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/food" className="text-xs text-slate-500 hover:text-slate-900">← all foods</Link>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">{food.name}</h1>
      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
        <span>Category: {food.category.replace(/_/g, ' ')}</span>
        <span>Serving: {food.serving_description} ({Number(food.serving_size_g)} g)</span>
        {food.glycemic_index !== null && <span>GI: {food.glycemic_index}</span>}
      </div>
      {food.notes && <p className="mt-3 text-sm italic text-slate-500">{food.notes}</p>}

      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        <div>
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">Vitamins (% RDA / serving)</h2>
          <NutrientRadarChart data={vitaminData} />
        </div>
        <div>
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">Minerals (% RDA / serving)</h2>
          <NutrientBarChart data={mineralData} />
        </div>
      </div>

      <h2 className="mt-12 text-lg font-medium">Full micronutrient profile</h2>
      {profile.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">No nutrient data seeded for this food.</p>
      ) : (
        <NutrientProfileTable rows={profile} />
      )}

      <p className="mt-10 text-xs text-slate-400">
        Charts cap at 100% RDA for readability — the table shows exact amounts. Data: USDA FoodData Central and curated peer-reviewed literature. RDAs from NIH ODS.
      </p>
    </main>
  );
}
