import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">WholeFood RX</h1>
      <p className="mt-3 text-lg text-slate-600">
        Pick a micronutrient — get the whole-food sources that deliver it best.
        Sourced from USDA FoodData Central and peer-reviewed literature. No supplement hype.
      </p>
      <div className="mt-10 flex gap-4">
        <Link
          href="/nutrient"
          className="rounded-md bg-slate-900 px-5 py-3 text-white hover:bg-slate-800"
        >
          Browse nutrients
        </Link>
      </div>
    </main>
  );
}
