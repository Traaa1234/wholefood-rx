CREATE TYPE "public"."data_source" AS ENUM('usda_foundation', 'usda_sr_legacy', 'curated');--> statement-breakpoint
CREATE TYPE "public"."food_category" AS ENUM('fruit', 'vegetable', 'leafy_green', 'nut', 'seed', 'legume', 'whole_grain', 'herb_adaptogen', 'mushroom', 'animal_protein', 'seafood', 'dairy');--> statement-breakpoint
CREATE TYPE "public"."interaction_kind" AS ENUM('synergy', 'antagonist', 'cofactor');--> statement-breakpoint
CREATE TYPE "public"."nutrient_category" AS ENUM('vitamin_fat_soluble', 'vitamin_water_soluble', 'macro_mineral', 'trace_mineral', 'essential_amino_acid', 'conditionally_essential_aa', 'essential_fatty_acid', 'adaptogen', 'phytonutrient');--> statement-breakpoint
CREATE TABLE "food_nutrients" (
	"food_id" integer NOT NULL,
	"nutrient_id" integer NOT NULL,
	"amount_per_100g" numeric NOT NULL,
	"amount_per_serving" numeric NOT NULL,
	"bioavailability_score" numeric,
	"preparation_notes" text,
	"data_source" "data_source" NOT NULL,
	"citation_url" text,
	"last_verified_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "food_nutrients_food_id_nutrient_id_data_source_pk" PRIMARY KEY("food_id","nutrient_id","data_source")
);
--> statement-breakpoint
CREATE TABLE "foods" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"category" "food_category" NOT NULL,
	"fdc_id" integer,
	"serving_size_g" numeric NOT NULL,
	"serving_description" text NOT NULL,
	"organic_available" boolean DEFAULT true,
	"seasonality" text,
	"glycemic_index" integer,
	"notes" text,
	CONSTRAINT "foods_slug_unique" UNIQUE("slug"),
	CONSTRAINT "foods_fdc_id_unique" UNIQUE("fdc_id")
);
--> statement-breakpoint
CREATE TABLE "nutrient_interactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"nutrient_a_id" integer NOT NULL,
	"nutrient_b_id" integer NOT NULL,
	"kind" "interaction_kind" NOT NULL,
	"notes" text NOT NULL,
	"citation_url" text,
	CONSTRAINT "nutrient_interactions_diff" CHECK ("nutrient_interactions"."nutrient_a_id" <> "nutrient_interactions"."nutrient_b_id")
);
--> statement-breakpoint
CREATE TABLE "nutrients" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"category" "nutrient_category" NOT NULL,
	"rda_male" numeric,
	"rda_female" numeric,
	"unit" text NOT NULL,
	"function_summary" text,
	"deficiency_symptoms" text,
	"toxicity_threshold" numeric,
	"cofactors" text[],
	"absorption_notes" text,
	CONSTRAINT "nutrients_slug_unique" UNIQUE("slug"),
	CONSTRAINT "nutrients_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "symptom_nutrients" (
	"symptom_id" integer NOT NULL,
	"nutrient_id" integer NOT NULL,
	"strength" smallint NOT NULL,
	"notes" text,
	CONSTRAINT "symptom_nutrients_symptom_id_nutrient_id_pk" PRIMARY KEY("symptom_id","nutrient_id")
);
--> statement-breakpoint
CREATE TABLE "symptoms" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	CONSTRAINT "symptoms_slug_unique" UNIQUE("slug"),
	CONSTRAINT "symptoms_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "food_nutrients" ADD CONSTRAINT "food_nutrients_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_nutrients" ADD CONSTRAINT "food_nutrients_nutrient_id_nutrients_id_fk" FOREIGN KEY ("nutrient_id") REFERENCES "public"."nutrients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nutrient_interactions" ADD CONSTRAINT "nutrient_interactions_nutrient_a_id_nutrients_id_fk" FOREIGN KEY ("nutrient_a_id") REFERENCES "public"."nutrients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nutrient_interactions" ADD CONSTRAINT "nutrient_interactions_nutrient_b_id_nutrients_id_fk" FOREIGN KEY ("nutrient_b_id") REFERENCES "public"."nutrients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "symptom_nutrients" ADD CONSTRAINT "symptom_nutrients_symptom_id_symptoms_id_fk" FOREIGN KEY ("symptom_id") REFERENCES "public"."symptoms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "symptom_nutrients" ADD CONSTRAINT "symptom_nutrients_nutrient_id_nutrients_id_fk" FOREIGN KEY ("nutrient_id") REFERENCES "public"."nutrients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "food_nutrients_nutrient_density" ON "food_nutrients" USING btree ("nutrient_id","amount_per_100g");--> statement-breakpoint
CREATE INDEX "food_nutrients_nutrient_serving" ON "food_nutrients" USING btree ("nutrient_id","amount_per_serving");