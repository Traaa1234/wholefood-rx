import { config } from 'dotenv';
config({ path: '.env.local' });
import { seedNutrients } from './seed-nutrients';
import { seedFoodsUsda } from './seed-foods-usda';
import { seedCurated } from './seed-curated';
import { seedSymptoms } from './seed-symptoms';
import { seedInteractions } from './seed-interactions';

async function main() {
  await seedNutrients();
  await seedFoodsUsda();
  await seedCurated();
  await seedSymptoms();
  await seedInteractions();
  console.log('\nAll seeds complete.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
