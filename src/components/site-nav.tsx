import Link from 'next/link';

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/nutrient', label: 'Nutrients' },
  { href: '/food', label: 'Foods' },
  { href: '/symptoms', label: 'Symptoms' },
  { href: '/plate', label: 'My Plate' },
];

export function SiteNav() {
  return (
    <header className="border-b border-slate-200">
      <nav className="mx-auto flex max-w-5xl items-center gap-1 px-6 py-3">
        <Link href="/" className="mr-4 font-semibold tracking-tight">
          WholeFood RX
        </Link>
        {LINKS.slice(1).map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
