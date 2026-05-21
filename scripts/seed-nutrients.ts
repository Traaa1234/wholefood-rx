import { config } from 'dotenv';
config({ path: '.env.local' });
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { nutrients } from '../src/lib/schema';

type NutrientRow = {
  slug: string;
  name: string;
  category: typeof nutrients.$inferInsert.category;
  rda_male: number | null;
  rda_female: number | null;
  unit: string;
  function_summary: string | null;
  deficiency_symptoms: string | null;
  toxicity_threshold: number | null;
  cofactors: string[];
  absorption_notes: string | null;
};

export async function seedNutrients() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);

  const path = resolve(process.cwd(), 'src/data/nutrients.json');
  const rows: NutrientRow[] = JSON.parse(readFileSync(path, 'utf8'));

  console.log(`Seeding ${rows.length} nutrients…`);

  for (const r of rows) {
    const values = {
      slug: r.slug,
      name: r.name,
      category: r.category,
      rdaMale: r.rda_male !== null ? String(r.rda_male) : null,
      rdaFemale: r.rda_female !== null ? String(r.rda_female) : null,
      unit: r.unit,
      functionSummary: r.function_summary,
      deficiencySymptoms: r.deficiency_symptoms,
      toxicityThreshold: r.toxicity_threshold !== null ? String(r.toxicity_threshold) : null,
      cofactors: r.cofactors,
      absorptionNotes: r.absorption_notes,
    };
    await db
      .insert(nutrients)
      .values(values)
      .onConflictDoUpdate({
        target: nutrients.slug,
        set: {
          name: values.name,
          category: values.category,
          rdaMale: values.rdaMale,
          rdaFemale: values.rdaFemale,
          unit: values.unit,
          functionSummary: values.functionSummary,
          deficiencySymptoms: values.deficiencySymptoms,
          toxicityThreshold: values.toxicityThreshold,
          cofactors: values.cofactors,
          absorptionNotes: values.absorptionNotes,
        },
      });
  }

  console.log('Nutrients seeded.');
}

// Direct-run guard: resolve argv[1] to an absolute file:// URL so it matches
// import.meta.url regardless of OS (Windows passes a relative argv[1] under tsx,
// and differs in drive-letter casing / slash direction).
const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href.toLowerCase()
  : '';
if (import.meta.url.toLowerCase() === invokedPath) {
  seedNutrients().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
