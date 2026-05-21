import Link from 'next/link';
import { pctRda } from '@/lib/rda';

type Props = {
  rank: number;
  food_slug: string;
  food_name: string;
  serving_description: string;
  amount_per_100g: string;
  amount_per_serving: string;
  data_source: string;
  citation_url: string | null;
  unit: string;
  rda: string | null;
  basis: 'per_100g' | 'per_serving';
};

export function FoodRankRow(p: Props) {
  const shown = p.basis === 'per_100g' ? Number(p.amount_per_100g) : Number(p.amount_per_serving);
  const pct = pctRda(p.amount_per_serving, p.rda);
  return (
    <li className="flex items-center justify-between border-b border-slate-100 py-3">
      <div className="flex items-baseline gap-3">
        <span className="w-6 text-right font-mono text-sm text-slate-400">{p.rank}.</span>
        <div>
          <Link href={`/food/${p.food_slug}`} className="font-medium hover:underline">
            {p.food_name}
          </Link>
          <div className="text-xs text-slate-500">{p.serving_description}</div>
        </div>
      </div>
      <div className="flex items-baseline gap-4">
        <span className="font-mono text-sm">
          {shown.toLocaleString(undefined, { maximumFractionDigits: 2 })} {p.unit}
        </span>
        {pct !== null && (
          <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
            {pct}% RDA
          </span>
        )}
        {p.citation_url && (
          <Link
            href={p.citation_url}
            target="_blank"
            rel="noopener"
            className="text-xs text-slate-400 hover:text-slate-700"
          >
            source
          </Link>
        )}
      </div>
    </li>
  );
}
