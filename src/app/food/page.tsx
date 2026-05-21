import Link from 'next/link';
import { listFoods } from '@/lib/queries';
import { AddToPlateButton } from '@/components/add-to-plate-button';

export const dynamic = 'force-dynamic';

const CATEGORY_LABELS: Record<string, string> = {
  fruit: 'Fruits',
  vegetable: 'Vegetables',
  leafy_green: 'Leafy greens',
  nut: 'Nuts',
  seed: 'Seeds',
  legume: 'Legumes',
  whole_grain: 'Whole grains',
  herb_adaptogen: 'Herbs & adaptogens',
  mushroom: 'Mushrooms',
  animal_protein: 'Animal protein',
  seafood: 'Seafood',
  dairy: 'Dairy',
};

export default async function FoodIndex() {
  const all = await listFoods();
  const grouped = new Map<string, typeof all>();
  for (const f of all) {
    const list = grouped.get(f.category) ?? [];
    list.push(f);
    grouped.set(f.category, list);
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Food catalog</h1>
      <p className="mt-2 text-slate-600">
        {all.length} whole foods. Click any food to see its full micronutrient profile.
      </p>

      {Array.from(grouped.entries()).map(([cat, items]) => (
        <section key={cat} className="mt-10">
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
            {CATEGORY_LABELS[cat] ?? cat} <span className="text-slate-400">({items.length})</span>
          </h2>
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((f) => (
              <li key={f.slug} className="flex items-center justify-between gap-2 rounded-md border border-slate-200 px-4 py-2.5">
                <Link href={`/food/${f.slug}`} className="text-sm hover:underline">
                  {f.name}
                </Link>
                <AddToPlateButton slug={f.slug} name={f.name} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
