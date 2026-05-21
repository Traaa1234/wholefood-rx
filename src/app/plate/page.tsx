import { PlateBuilder } from '@/components/plate-builder';

export const metadata = { title: 'My Plate · WholeFood RX' };

export default function PlatePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Daily plate builder</h1>
      <p className="mt-2 text-slate-600">
        Add whole foods to today&apos;s plate and see how much of each micronutrient&apos;s RDA
        you&apos;re covering. Stored in your browser only — no account needed.
      </p>
      <PlateBuilder />
    </main>
  );
}
