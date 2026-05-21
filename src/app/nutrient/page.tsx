import Link from 'next/link';
import { listNutrients } from '@/lib/queries';

export const dynamic = 'force-dynamic';

const CATEGORY_LABELS: Record<string, string> = {
  vitamin_fat_soluble: 'Fat-soluble vitamins',
  vitamin_water_soluble: 'Water-soluble vitamins',
  macro_mineral: 'Macro minerals',
  trace_mineral: 'Trace minerals',
  essential_amino_acid: 'Essential amino acids',
  conditionally_essential_aa: 'Conditionally essential amino acids',
  essential_fatty_acid: 'Essential fatty acids',
  adaptogen: 'Adaptogens',
  phytonutrient: 'Phytonutrients',
};

export default async function NutrientIndex() {
  const all = await listNutrients();
  const grouped = new Map<string, typeof all>();
  for (const n of all) {
    const list = grouped.get(n.category) ?? [];
    list.push(n);
    grouped.set(n.category, list);
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Nutrient catalog</h1>
      <p className="mt-2 text-slate-600">Click any nutrient to see top whole-food sources.</p>

      {Array.from(grouped.entries()).map(([cat, items]) => (
        <section key={cat} className="mt-10">
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
            {CATEGORY_LABELS[cat] ?? cat}
          </h2>
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((n) => (
              <li key={n.slug}>
                <Link
                  href={`/nutrient/${n.slug}`}
                  className="block rounded-md border border-slate-200 px-4 py-3 hover:border-slate-400 hover:bg-slate-50"
                >
                  <div className="font-medium">{n.name}</div>
                  <div className="text-xs text-slate-500">{n.unit}</div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
