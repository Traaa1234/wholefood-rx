import { config } from 'dotenv';
config({ path: '.env.local' });
import { rankFoodsByNutrient, getNutrient, listNutrients } from '../src/lib/queries';

async function main() {
  const all = await listNutrients();
  console.log('listNutrients count:', all.length);

  const vc = await getNutrient('vitamin-c');
  console.log('getNutrient(vitamin-c):', vc ? vc.name : 'NULL');
  console.log('getNutrient(nonexistent):', await getNutrient('xyz-not-real'));

  console.log('\nTop 10 vitamin-c per 100g:');
  for (const r of await rankFoodsByNutrient('vitamin-c', 'per_100g', null, 10)) {
    console.log('  ' + r.food_name.padEnd(46) + String(Number(r.amount_per_100g).toFixed(1)).padStart(8) + ' [' + r.data_source + ']');
  }

  console.log('\nTop 5 iron per serving, legumes only:');
  for (const r of await rankFoodsByNutrient('iron', 'per_serving', 'legume', 5)) {
    console.log('  ' + r.food_name.padEnd(46) + String(Number(r.amount_per_serving).toFixed(2)).padStart(8));
  }

  console.log('\nTop 3 sulforaphane (curated nutrient):');
  for (const r of await rankFoodsByNutrient('sulforaphane', 'per_100g', null, 3)) {
    console.log('  ' + r.food_name + ' [' + r.data_source + ']');
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
