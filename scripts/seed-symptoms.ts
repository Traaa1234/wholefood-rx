import { config } from 'dotenv';
config({ path: '.env.local' });
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { symptoms, symptomNutrients, nutrients } from '../src/lib/schema';

type SymptomRow = { slug: string; name: string; description: string };
type LinkRow = { symptom_slug: string; nutrient_slug: string; strength: number };

export async function seedSymptoms() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);

  const sym: SymptomRow[] = JSON.parse(
    readFileSync(resolve(process.cwd(), 'src/data/symptoms.json'), 'utf8')
  );
  const links: LinkRow[] = JSON.parse(
    readFileSync(resolve(process.cwd(), 'src/data/symptom-nutrients.json'), 'utf8')
  );

  console.log(`Seeding ${sym.length} symptoms…`);
  for (const s of sym) {
    await db.insert(symptoms).values(s).onConflictDoUpdate({
      target: symptoms.slug,
      set: { name: s.name, description: s.description },
    });
  }

  // Build slug -> id lookups for symptoms and nutrients.
  const sRows = await db.select({ id: symptoms.id, slug: symptoms.slug }).from(symptoms);
  const nRows = await db.select({ id: nutrients.id, slug: nutrients.slug }).from(nutrients);
  const sIdx = new Map(sRows.map((r) => [r.slug, r.id]));
  const nIdx = new Map(nRows.map((r) => [r.slug, r.id]));

  console.log(`Seeding ${links.length} symptom_nutrient links…`);
  for (const l of links) {
    const sid = sIdx.get(l.symptom_slug);
    const nid = nIdx.get(l.nutrient_slug);
    if (!sid || !nid) {
      console.warn(`Skipping ${l.symptom_slug} / ${l.nutrient_slug} — missing reference`);
      continue;
    }
    await db
      .insert(symptomNutrients)
      .values({
        symptomId: sid,
        nutrientId: nid,
        strength: l.strength,
      })
      .onConflictDoUpdate({
        target: [symptomNutrients.symptomId, symptomNutrients.nutrientId],
        set: { strength: l.strength },
      });
  }
  console.log('Symptoms seeded.');
}

// Direct-run guard: resolve argv[1] to an absolute file:// URL so it matches
// import.meta.url regardless of OS (Windows passes a relative argv[1] under tsx,
// and differs in drive-letter casing / slash direction).
const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href.toLowerCase()
  : '';
if (import.meta.url.toLowerCase() === invokedPath) {
  seedSymptoms().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
