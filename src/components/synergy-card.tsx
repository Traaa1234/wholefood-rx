import type { InteractionRow } from '@/lib/queries';

const KIND_META: Record<string, { label: string; cls: string }> = {
  synergy: { label: 'Synergy', cls: 'bg-emerald-50 text-emerald-700' },
  antagonist: { label: 'Antagonist', cls: 'bg-rose-50 text-rose-700' },
  cofactor: { label: 'Cofactor', cls: 'bg-sky-50 text-sky-700' },
};

export function SynergyCard({
  interactions,
  title = 'Absorption & synergy notes',
}: {
  interactions: InteractionRow[];
  title?: string;
}) {
  if (interactions.length === 0) return null;
  return (
    <section className="mt-8 rounded-lg border border-slate-200 p-5">
      <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">{title}</h2>
      <ul className="mt-3 space-y-3">
        {interactions.map((ix, i) => {
          const meta = KIND_META[ix.kind] ?? { label: ix.kind, cls: 'bg-slate-100 text-slate-700' };
          return (
            <li key={`${ix.a_slug}-${ix.b_slug}-${i}`} className="text-sm">
              <div className="flex items-center gap-2">
                <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${meta.cls}`}>
                  {meta.label}
                </span>
                <span className="font-medium">{ix.a_name} + {ix.b_name}</span>
              </div>
              <p className="mt-1 text-slate-600">{ix.notes}</p>
              {ix.citation_url && (
                <a href={ix.citation_url} target="_blank" rel="noopener" className="text-xs text-slate-400 hover:text-slate-700">
                  source
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
