'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'wholefoodrx-plate';

type Entry = { slug: string; servings: number };

function readPlate(): Entry[] {
  if (typeof window === 'undefined') return [];
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

export function AddToPlateButton({ slug, name }: { slug: string; name: string }) {
  const [inPlate, setInPlate] = useState(false);

  useEffect(() => {
    setInPlate(readPlate().some((e) => e.slug === slug));
  }, [slug]);

  function toggle() {
    const plate = readPlate();
    const exists = plate.some((e) => e.slug === slug);
    const next = exists
      ? plate.filter((e) => e.slug !== slug)
      : [...plate, { slug, servings: 1 }];
    writePlate(next);
    setInPlate(!exists);
  }

  return (
    <button
      onClick={toggle}
      className={`rounded-md border px-3 py-1.5 text-sm ${
        inPlate
          ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
          : 'border-slate-300 text-slate-700 hover:border-slate-500'
      }`}
      aria-label={inPlate ? `Remove ${name} from plate` : `Add ${name} to plate`}
    >
      {inPlate ? '✓ On plate' : '+ Add to plate'}
    </button>
  );
}
