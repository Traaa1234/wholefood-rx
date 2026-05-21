'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { getPlateData } from '@/app/plate/actions';
import { computePlateTotals, type PlateTotal } from '@/lib/plate';

const STORAGE_KEY = 'wholefoodrx-plate';

type Entry = { slug: string; servings: number };

function readPlate(): Entry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Entry[]) : [];
  } catch {
    return [];
  }
}

function writePlate(entries: Entry[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

type FoodView = { slug: string; name: string; servings: number };

export function PlateBuilder() {
  const [loading, setLoading] = useState(true);
  const [foods, setFoods] = useState<FoodView[]>([]);
  const [totals, setTotals] = useState<PlateTotal[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const entries = readPlate();
    if (entries.length === 0) {
      setFoods([]);
      setTotals([]);
      setLoading(false);
      return;
    }
    const data = await getPlateData(entries);
    if (data.missingSlugs.length > 0) {
      writePlate(entries.filter((e) => !data.missingSlugs.includes(e.slug)));
    }
    setFoods(data.foods.map((f) => ({ slug: f.slug, name: f.name, servings: f.servings })));
    setTotals(computePlateTotals(data.foods, data.nutrients));
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  function setServings(slug: string, servings: number) {
    if (servings < 1) return;
    writePlate(readPlate().map((e) => (e.slug === slug ? { ...e, servings } : e)));
    void refresh();
  }

  function remove(slug: string) {
    writePlate(readPlate().filter((e) => e.slug !== slug));
    void refresh();
  }

  function clearAll() {
    writePlate([]);
    void refresh();
  }

  if (loading) return <p className="mt-8 text-sm text-slate-500">Loading your plate…</p>;

  if (foods.length === 0) {
    return (
      <p className="mt-8 text-sm text-slate-500">
        Your plate is empty. Browse the{' '}
        <Link href="/food" className="underline">food catalog</Link>{' '}
        and add foods to see your cumulative nutrient coverage.
      </p>
    );
  }

  const covered = totals.filter((t) => t.pctRda !== null);
  const gaps = covered.filter((t) => t.isGap);
  const sortedTotals = [...covered].sort((a, b) => (a.pctRda ?? 0) - (b.pctRda ?? 0));

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Today&apos;s plate ({foods.length})</h2>
        <button onClick={clearAll} className="text-xs text-slate-400 hover:text-rose-600">
          clear all
        </button>
      </div>
      <ul className="mt-3">
        {foods.map((f) => (
          <li key={f.slug} className="flex items-center justify-between border-b border-slate-100 py-2">
            <Link href={`/food/${f.slug}`} className="text-sm hover:underline">{f.name}</Link>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1 text-xs text-slate-500">
                servings
                <input
                  type="number"
                  min={1}
                  value={f.servings}
                  onChange={(e) => setServings(f.slug, Number(e.target.value))}
                  className="w-14 rounded border border-slate-300 px-1.5 py-0.5 text-sm"
                />
              </label>
              <button onClick={() => remove(f.slug)} className="text-xs text-slate-400 hover:text-rose-600">
                remove
              </button>
            </div>
          </li>
        ))}
      </ul>

      {gaps.length > 0 && (
        <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h3 className="text-sm font-medium text-amber-800">
            Biggest gaps ({gaps.length} nutrients under 25% RDA)
          </h3>
          <p className="mt-1 text-sm text-amber-700">
            {gaps.slice(0, 8).map((g) => g.name).join(', ')}
          </p>
        </div>
      )}

      <h3 className="mt-8 text-sm font-medium uppercase tracking-wide text-slate-500">
        Cumulative coverage (lowest first)
      </h3>
      <ul className="mt-2">
        {sortedTotals.map((t) => (
          <li key={t.slug} className="flex items-center gap-3 border-b border-slate-100 py-1.5 text-sm">
            <Link href={`/nutrient/${t.slug}`} className="w-48 shrink-0 hover:underline">{t.name}</Link>
            <div className="h-2 flex-1 rounded bg-slate-100">
              <div
                className={`h-2 rounded ${t.isGap ? 'bg-amber-400' : 'bg-emerald-500'}`}
                style={{ width: `${Math.min(t.pctRda ?? 0, 100)}%` }}
              />
            </div>
            <span className="w-24 shrink-0 text-right font-mono text-xs text-slate-600">
              {t.amount.toLocaleString(undefined, { maximumFractionDigits: 1 })} {t.unit}
            </span>
            <span className="w-12 shrink-0 text-right text-xs">{t.pctRda}%</span>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-xs text-slate-400">
        Coverage uses per-serving amounts × your serving counts. Nutrients without an
        established RDA (most adaptogens, phytonutrients, EPA/DHA) are omitted from coverage.
      </p>
    </div>
  );
}
