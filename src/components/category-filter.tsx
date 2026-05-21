'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

const CATEGORIES = [
  'fruit', 'vegetable', 'leafy_green', 'nut', 'seed', 'legume', 'whole_grain',
  'herb_adaptogen', 'mushroom', 'animal_protein', 'seafood', 'dairy',
];

export function CategoryFilter({ active }: { active: string | null }) {
  const path = usePathname();
  const params = useSearchParams();
  const buildHref = (cat: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (cat) next.set('category', cat);
    else next.delete('category');
    const qs = next.toString();
    return qs ? `${path}?${qs}` : path;
  };
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      <Link
        href={buildHref(null)}
        className={`rounded-full border px-3 py-1 ${active === null ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 text-slate-700'}`}
      >
        all
      </Link>
      {CATEGORIES.map((c) => (
        <Link
          key={c}
          href={buildHref(c)}
          className={`rounded-full border px-3 py-1 ${active === c ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 text-slate-700'}`}
        >
          {c.replace(/_/g, ' ')}
        </Link>
      ))}
    </div>
  );
}
