import { config } from 'dotenv';
config({ path: '.env.local' });
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { nutrientInteractions, nutrients } from '../src/lib/schema';

type IxRow = {
  a: string;
  b: string;
  kind: 'synergy' | 'antagonist' | 'cofactor';
  notes: string;
  citation: string;
};

export async function seedInteractions() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);

  const rows: IxRow[] = JSON.parse(
    readFileSync(resolve(process.cwd(), 'src/data/nutrient-interactions.json'), 'utf8')
  );
  const nRows = await db.select({ id: nutrients.id, slug: nutrients.slug }).from(nutrients);
  const nIdx = new Map(nRows.map((r) => [r.slug, r.id]));

  // Naive idempotency: clear then insert. Acceptable for small table; preserves PK shape.
  await db.delete(nutrientInteractions);

  console.log(`Seeding ${rows.length} nutrient interactions…`);
  for (const r of rows) {
    const a = nIdx.get(r.a);
    const b = nIdx.get(r.b);
    if (!a || !b) {
      console.warn(`Skipping ${r.a} <-> ${r.b} — missing nutrient`);
      continue;
    }
    await db.insert(nutrientInteractions).values({
      nutrientAId: a,
      nutrientBId: b,
      kind: r.kind,
      notes: r.notes,
      citationUrl: r.citation,
    });
  }
  console.log('Interactions seeded.');
}

// Direct-run guard: resolve argv[1] to an absolute file:// URL so it matches
// import.meta.url regardless of OS (Windows passes a relative argv[1] under tsx,
// and differs in drive-letter casing / slash direction).
const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href.toLowerCase()
  : '';
if (import.meta.url.toLowerCase() === invokedPath) {
  seedInteractions().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
