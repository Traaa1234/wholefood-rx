'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

type Symptom = { slug: string; name: string };

export function SymptomSelector({ symptoms }: { symptoms: Symptom[] }) {
  const path = usePathname();
  const params = useSearchParams();
  const selected = new Set(params.getAll('s'));

  function hrefToggling(slug: string): string {
    const after = new Set(selected);
    if (after.has(slug)) after.delete(slug);
    else after.add(slug);
    const next = new URLSearchParams();
    for (const s of after) next.append('s', s);
    const qs = next.toString();
    return qs ? `${path}?${qs}` : path;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {symptoms.map((s) => {
        const on = selected.has(s.slug);
        return (
          <Link
            key={s.slug}
            href={hrefToggling(s.slug)}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              on
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-300 text-slate-700 hover:border-slate-500'
            }`}
          >
            {s.name}
          </Link>
        );
      })}
    </div>
  );
}
