import {
  pgTable, pgEnum, serial, text, integer, numeric, boolean,
  timestamp, smallint, primaryKey, index, check
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const nutrientCategory = pgEnum('nutrient_category', [
  'vitamin_fat_soluble', 'vitamin_water_soluble', 'macro_mineral',
  'trace_mineral', 'essential_amino_acid', 'conditionally_essential_aa',
  'essential_fatty_acid', 'adaptogen', 'phytonutrient',
]);

export const foodCategory = pgEnum('food_category', [
  'fruit', 'vegetable', 'leafy_green', 'nut', 'seed', 'legume',
  'whole_grain', 'herb_adaptogen', 'mushroom', 'animal_protein',
  'seafood', 'dairy',
]);

export const dataSource = pgEnum('data_source', [
  'usda_foundation', 'usda_sr_legacy', 'curated',
]);

export const interactionKind = pgEnum('interaction_kind', [
  'synergy', 'antagonist', 'cofactor',
]);

export const nutrients = pgTable('nutrients', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull().unique(),
  category: nutrientCategory('category').notNull(),
  rdaMale: numeric('rda_male'),
  rdaFemale: numeric('rda_female'),
  unit: text('unit').notNull(),
  functionSummary: text('function_summary'),
  deficiencySymptoms: text('deficiency_symptoms'),
  toxicityThreshold: numeric('toxicity_threshold'),
  cofactors: text('cofactors').array(),
  absorptionNotes: text('absorption_notes'),
});

export const foods = pgTable('foods', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  category: foodCategory('category').notNull(),
  fdcId: integer('fdc_id').unique(),
  servingSizeG: numeric('serving_size_g').notNull(),
  servingDescription: text('serving_description').notNull(),
  organicAvailable: boolean('organic_available').default(true),
  seasonality: text('seasonality'),
  glycemicIndex: integer('glycemic_index'),
  notes: text('notes'),
});

export const foodNutrients = pgTable(
  'food_nutrients',
  {
    foodId: integer('food_id').notNull().references(() => foods.id, { onDelete: 'cascade' }),
    nutrientId: integer('nutrient_id').notNull().references(() => nutrients.id, { onDelete: 'cascade' }),
    amountPer100g: numeric('amount_per_100g').notNull(),
    amountPerServing: numeric('amount_per_serving').notNull(),
    bioavailabilityScore: numeric('bioavailability_score'),
    preparationNotes: text('preparation_notes'),
    dataSource: dataSource('data_source').notNull(),
    citationUrl: text('citation_url'),
    lastVerifiedAt: timestamp('last_verified_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.foodId, t.nutrientId, t.dataSource] }),
    densityIdx: index('food_nutrients_nutrient_density').on(t.nutrientId, t.amountPer100g),
    servingIdx: index('food_nutrients_nutrient_serving').on(t.nutrientId, t.amountPerServing),
  })
);

export const symptoms = pgTable('symptoms', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull().unique(),
  description: text('description'),
});

export const symptomNutrients = pgTable(
  'symptom_nutrients',
  {
    symptomId: integer('symptom_id').notNull().references(() => symptoms.id, { onDelete: 'cascade' }),
    nutrientId: integer('nutrient_id').notNull().references(() => nutrients.id, { onDelete: 'cascade' }),
    strength: smallint('strength').notNull(),
    notes: text('notes'),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.symptomId, t.nutrientId] }),
  })
);

export const nutrientInteractions = pgTable(
  'nutrient_interactions',
  {
    id: serial('id').primaryKey(),
    nutrientAId: integer('nutrient_a_id').notNull().references(() => nutrients.id, { onDelete: 'cascade' }),
    nutrientBId: integer('nutrient_b_id').notNull().references(() => nutrients.id, { onDelete: 'cascade' }),
    kind: interactionKind('kind').notNull(),
    notes: text('notes').notNull(),
    citationUrl: text('citation_url'),
  },
  (t) => ({
    diff: check('nutrient_interactions_diff', sql`${t.nutrientAId} <> ${t.nutrientBId}`),
  })
);
