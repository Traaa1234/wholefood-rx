'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

export function NutrientToggle({ basis }: { basis: 'per_100g' | 'per_serving' }) {
  const path = usePathname();
  const params = useSearchParams();
  const other = basis === 'per_100g' ? 'per_serving' : 'per_100g';
  const next = new URLSearchParams(params.toString());
  next.set('basis', other);
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-slate-300 text-sm">
      <button
        className={`px-3 py-1.5 ${basis === 'per_100g' ? 'bg-slate-900 text-white' : 'text-slate-700'}`}
        disabled
      >
        per 100 g
      </button>
      <Link
        href={`${path}?${next.toString()}`}
        className={`px-3 py-1.5 ${basis === 'per_serving' ? 'bg-slate-900 text-white' : 'text-slate-700'}`}
      >
        per serving
      </Link>
    </div>
  );
}
