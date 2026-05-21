import { config } from 'dotenv';
config({ path: '.env.local' });
import {
  listSymptoms, getNutrientsForSymptoms,
  getInteractionsForNutrient, getInteractionsAmongNutrientSlugs,
} from '../src/lib/queries';

async function main() {
  const symptoms = await listSymptoms();
  console.log('listSymptoms count:', symptoms.length);
  console.log('empty symptom selection:', await getNutrientsForSymptoms([]));

  const picked = ['fatigue', 'poor-sleep'];
  const ranked = await getNutrientsForSymptoms(picked);
  console.log(`\nnutrients for ${picked.join(' + ')}:`);
  for (const r of ranked.slice(0, 8)) {
    console.log(`  ${r.nutrient_name.padEnd(36)} strength=${r.total_strength} symptoms=${r.symptom_count}`);
  }

  console.log('\ninteractions for iron:');
  for (const ix of await getInteractionsForNutrient('iron')) {
    console.log(`  [${ix.kind}] ${ix.a_name} <-> ${ix.b_name}`);
  }

  console.log('\ninteractions among [iron, vitamin-c, calcium]:');
  for (const ix of await getInteractionsAmongNutrientSlugs(['iron', 'vitamin-c', 'calcium'])) {
    console.log(`  [${ix.kind}] ${ix.a_name} <-> ${ix.b_name}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
