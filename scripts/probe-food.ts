import { config } from 'dotenv';
config({ path: '.env.local' });
import { listFoods, getFood, getFoodNutrientProfile } from '../src/lib/queries';

async function main() {
  const foods = await listFoods();
  console.log('listFoods count:', foods.length);
  const sample = foods.find((f) => f.slug.includes('broccoli')) ?? foods[0];
  console.log('sample food slug:', sample.slug);

  const food = await getFood(sample.slug);
  console.log('getFood:', food ? `${food.name} (serving ${food.serving_size_g}g)` : 'NULL');
  console.log('getFood(bad-slug):', await getFood('not-a-real-food'));

  if (food) {
    const profile = await getFoodNutrientProfile(food.id);
    console.log(`profile rows for ${food.name}:`, profile.length);
    console.log('first 5:', profile.slice(0, 5).map((p) => `${p.nutrient_name}=${Number(p.amount_per_serving).toFixed(2)}${p.unit}`));
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
