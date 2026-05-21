import Link from 'next/link';
import type { FoodNutrientRow } from '@/lib/queries';
import { pctRda } from '@/lib/rda';

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

export function NutrientProfileTable({ rows }: { rows: FoodNutrientRow[] }) {
  const grouped = new Map<string, FoodNutrientRow[]>();
  for (const r of rows) {
    const list = grouped.get(r.nutrient_category) ?? [];
    list.push(r);
    grouped.set(r.nutrient_category, list);
  }

  return (
    <div className="mt-4 space-y-8">
      {Array.from(grouped.entries()).map(([cat, items]) => (
        <section key={cat}>
          <h3 className="text-sm font-medium uppercase tracking-wide text-slate-500">
            {CATEGORY_LABELS[cat] ?? cat}
          </h3>
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400">
                <th className="py-1.5">Nutrient</th>
                <th className="py-1.5 text-right">Per 100 g</th>
                <th className="py-1.5 text-right">Per serving</th>
                <th className="py-1.5 text-right">% RDA</th>
                <th className="py-1.5 text-right">Source</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => {
                const rda = r.rda_male ?? r.rda_female;
                const pct = pctRda(r.amount_per_serving, rda);
                return (
                  <tr key={r.nutrient_slug} className="border-b border-slate-100">
                    <td className="py-1.5">
                      <Link href={`/nutrient/${r.nutrient_slug}`} className="hover:underline">
                        {r.nutrient_name}
                      </Link>
                    </td>
                    <td className="py-1.5 text-right font-mono">
                      {Number(r.amount_per_100g).toLocaleString(undefined, { maximumFractionDigits: 2 })} {r.unit}
                    </td>
                    <td className="py-1.5 text-right font-mono">
                      {Number(r.amount_per_serving).toLocaleString(undefined, { maximumFractionDigits: 2 })} {r.unit}
                    </td>
                    <td className="py-1.5 text-right">
                      {pct !== null ? `${pct}%` : '—'}
                    </td>
                    <td className="py-1.5 text-right">
                      {r.citation_url ? (
                        <a href={r.citation_url} target="_blank" rel="noopener" className="text-xs text-slate-400 hover:text-slate-700">
                          {r.data_source === 'curated' ? 'cite' : 'USDA'}
                        </a>
                      ) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
