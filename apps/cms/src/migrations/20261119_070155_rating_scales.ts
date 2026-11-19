import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "rating_scales_tiers" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"slug" varchar NOT NULL,
  	"colour" varchar NOT NULL
  );
  
  CREATE TABLE "rating_scales_tiers_locales" (
  	"label" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "rating_scales_ratings" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"slug" varchar NOT NULL,
  	"tier" varchar NOT NULL,
  	"colour" varchar NOT NULL,
  	"text_colour" varchar NOT NULL,
  	"value" numeric NOT NULL,
  	"needs_deadline" boolean DEFAULT false,
  	"is_starting" boolean DEFAULT false,
  	"retired" boolean DEFAULT false
  );
  
  CREATE TABLE "rating_scales_ratings_locales" (
  	"label" varchar NOT NULL,
  	"definition" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "rating_scales" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"best_value" numeric NOT NULL,
  	"worst_value" numeric NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "rating_scales_locales" (
  	"name" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" uuid NOT NULL
  );
  
  CREATE TABLE "rating_scales_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" uuid
  );
  
  CREATE TABLE "_rating_scales_v_version_tiers" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"slug" varchar NOT NULL,
  	"colour" varchar NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_rating_scales_v_version_tiers_locales" (
  	"label" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" uuid NOT NULL
  );
  
  CREATE TABLE "_rating_scales_v_version_ratings" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"slug" varchar NOT NULL,
  	"tier" varchar NOT NULL,
  	"colour" varchar NOT NULL,
  	"text_colour" varchar NOT NULL,
  	"value" numeric NOT NULL,
  	"needs_deadline" boolean DEFAULT false,
  	"is_starting" boolean DEFAULT false,
  	"retired" boolean DEFAULT false,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_rating_scales_v_version_ratings_locales" (
  	"label" varchar NOT NULL,
  	"definition" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" uuid NOT NULL
  );
  
  CREATE TABLE "_rating_scales_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"parent_id" uuid,
  	"version_best_value" numeric NOT NULL,
  	"version_worst_value" numeric NOT NULL,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_rating_scales_v_locales" (
  	"version_name" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" uuid NOT NULL
  );
  
  CREATE TABLE "_rating_scales_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" uuid
  );
  
  CREATE TABLE "claim_types" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"slug" varchar NOT NULL,
  	"rating_scale_id" uuid NOT NULL,
  	"has_deadline" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "claim_types_locales" (
  	"name" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" uuid NOT NULL
  );
  
  CREATE TABLE "claim_types_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" uuid
  );
  
  CREATE TABLE "_claim_types_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"parent_id" uuid,
  	"version_slug" varchar NOT NULL,
  	"version_rating_scale_id" uuid NOT NULL,
  	"version_has_deadline" boolean DEFAULT false,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_claim_types_v_locales" (
  	"version_name" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" uuid NOT NULL
  );
  
  CREATE TABLE "_claim_types_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" uuid
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "rating_scales_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "claim_types_id" uuid;
  ALTER TABLE "rating_scales_tiers" ADD CONSTRAINT "rating_scales_tiers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."rating_scales"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "rating_scales_tiers_locales" ADD CONSTRAINT "rating_scales_tiers_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."rating_scales_tiers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "rating_scales_ratings" ADD CONSTRAINT "rating_scales_ratings_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."rating_scales"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "rating_scales_ratings_locales" ADD CONSTRAINT "rating_scales_ratings_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."rating_scales_ratings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "rating_scales_locales" ADD CONSTRAINT "rating_scales_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."rating_scales"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "rating_scales_rels" ADD CONSTRAINT "rating_scales_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."rating_scales"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "rating_scales_rels" ADD CONSTRAINT "rating_scales_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_rating_scales_v_version_tiers" ADD CONSTRAINT "_rating_scales_v_version_tiers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_rating_scales_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_rating_scales_v_version_tiers_locales" ADD CONSTRAINT "_rating_scales_v_version_tiers_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_rating_scales_v_version_tiers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_rating_scales_v_version_ratings" ADD CONSTRAINT "_rating_scales_v_version_ratings_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_rating_scales_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_rating_scales_v_version_ratings_locales" ADD CONSTRAINT "_rating_scales_v_version_ratings_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_rating_scales_v_version_ratings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_rating_scales_v" ADD CONSTRAINT "_rating_scales_v_parent_id_rating_scales_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."rating_scales"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_rating_scales_v_locales" ADD CONSTRAINT "_rating_scales_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_rating_scales_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_rating_scales_v_rels" ADD CONSTRAINT "_rating_scales_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_rating_scales_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_rating_scales_v_rels" ADD CONSTRAINT "_rating_scales_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "claim_types" ADD CONSTRAINT "claim_types_rating_scale_id_rating_scales_id_fk" FOREIGN KEY ("rating_scale_id") REFERENCES "public"."rating_scales"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "claim_types_locales" ADD CONSTRAINT "claim_types_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."claim_types"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "claim_types_rels" ADD CONSTRAINT "claim_types_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."claim_types"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "claim_types_rels" ADD CONSTRAINT "claim_types_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_claim_types_v" ADD CONSTRAINT "_claim_types_v_parent_id_claim_types_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."claim_types"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_claim_types_v" ADD CONSTRAINT "_claim_types_v_version_rating_scale_id_rating_scales_id_fk" FOREIGN KEY ("version_rating_scale_id") REFERENCES "public"."rating_scales"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_claim_types_v_locales" ADD CONSTRAINT "_claim_types_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_claim_types_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_claim_types_v_rels" ADD CONSTRAINT "_claim_types_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_claim_types_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_claim_types_v_rels" ADD CONSTRAINT "_claim_types_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "rating_scales_tiers_order_idx" ON "rating_scales_tiers" USING btree ("_order");
  CREATE INDEX "rating_scales_tiers_parent_id_idx" ON "rating_scales_tiers" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "rating_scales_tiers_locales_parent_id_locale_unique" ON "rating_scales_tiers_locales" USING btree ("_parent_id","_locale");
  CREATE INDEX "rating_scales_ratings_order_idx" ON "rating_scales_ratings" USING btree ("_order");
  CREATE INDEX "rating_scales_ratings_parent_id_idx" ON "rating_scales_ratings" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "rating_scales_ratings_locales_parent_id_locale_unique" ON "rating_scales_ratings_locales" USING btree ("_parent_id","_locale");
  CREATE INDEX "rating_scales_updated_at_idx" ON "rating_scales" USING btree ("updated_at");
  CREATE INDEX "rating_scales_created_at_idx" ON "rating_scales" USING btree ("created_at");
  CREATE UNIQUE INDEX "rating_scales_locales_parent_id_locale_unique" ON "rating_scales_locales" USING btree ("_parent_id","_locale");
  CREATE INDEX "rating_scales_rels_order_idx" ON "rating_scales_rels" USING btree ("order");
  CREATE INDEX "rating_scales_rels_parent_idx" ON "rating_scales_rels" USING btree ("parent_id");
  CREATE INDEX "rating_scales_rels_path_idx" ON "rating_scales_rels" USING btree ("path");
  CREATE INDEX "rating_scales_rels_users_id_idx" ON "rating_scales_rels" USING btree ("users_id");
  CREATE INDEX "_rating_scales_v_version_tiers_order_idx" ON "_rating_scales_v_version_tiers" USING btree ("_order");
  CREATE INDEX "_rating_scales_v_version_tiers_parent_id_idx" ON "_rating_scales_v_version_tiers" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_rating_scales_v_version_tiers_locales_parent_id_locale_uniq" ON "_rating_scales_v_version_tiers_locales" USING btree ("_parent_id","_locale");
  CREATE INDEX "_rating_scales_v_version_ratings_order_idx" ON "_rating_scales_v_version_ratings" USING btree ("_order");
  CREATE INDEX "_rating_scales_v_version_ratings_parent_id_idx" ON "_rating_scales_v_version_ratings" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_rating_scales_v_version_ratings_locales_parent_id_locale_un" ON "_rating_scales_v_version_ratings_locales" USING btree ("_parent_id","_locale");
  CREATE INDEX "_rating_scales_v_parent_idx" ON "_rating_scales_v" USING btree ("parent_id");
  CREATE INDEX "_rating_scales_v_version_version_updated_at_idx" ON "_rating_scales_v" USING btree ("version_updated_at");
  CREATE INDEX "_rating_scales_v_version_version_created_at_idx" ON "_rating_scales_v" USING btree ("version_created_at");
  CREATE INDEX "_rating_scales_v_created_at_idx" ON "_rating_scales_v" USING btree ("created_at");
  CREATE INDEX "_rating_scales_v_updated_at_idx" ON "_rating_scales_v" USING btree ("updated_at");
  CREATE UNIQUE INDEX "_rating_scales_v_locales_parent_id_locale_unique" ON "_rating_scales_v_locales" USING btree ("_parent_id","_locale");
  CREATE INDEX "_rating_scales_v_rels_order_idx" ON "_rating_scales_v_rels" USING btree ("order");
  CREATE INDEX "_rating_scales_v_rels_parent_idx" ON "_rating_scales_v_rels" USING btree ("parent_id");
  CREATE INDEX "_rating_scales_v_rels_path_idx" ON "_rating_scales_v_rels" USING btree ("path");
  CREATE INDEX "_rating_scales_v_rels_users_id_idx" ON "_rating_scales_v_rels" USING btree ("users_id");
  CREATE UNIQUE INDEX "claim_types_slug_idx" ON "claim_types" USING btree ("slug");
  CREATE INDEX "claim_types_rating_scale_idx" ON "claim_types" USING btree ("rating_scale_id");
  CREATE INDEX "claim_types_updated_at_idx" ON "claim_types" USING btree ("updated_at");
  CREATE INDEX "claim_types_created_at_idx" ON "claim_types" USING btree ("created_at");
  CREATE UNIQUE INDEX "claim_types_locales_parent_id_locale_unique" ON "claim_types_locales" USING btree ("_parent_id","_locale");
  CREATE INDEX "claim_types_rels_order_idx" ON "claim_types_rels" USING btree ("order");
  CREATE INDEX "claim_types_rels_parent_idx" ON "claim_types_rels" USING btree ("parent_id");
  CREATE INDEX "claim_types_rels_path_idx" ON "claim_types_rels" USING btree ("path");
  CREATE INDEX "claim_types_rels_users_id_idx" ON "claim_types_rels" USING btree ("users_id");
  CREATE INDEX "_claim_types_v_parent_idx" ON "_claim_types_v" USING btree ("parent_id");
  CREATE INDEX "_claim_types_v_version_version_slug_idx" ON "_claim_types_v" USING btree ("version_slug");
  CREATE INDEX "_claim_types_v_version_version_rating_scale_idx" ON "_claim_types_v" USING btree ("version_rating_scale_id");
  CREATE INDEX "_claim_types_v_version_version_updated_at_idx" ON "_claim_types_v" USING btree ("version_updated_at");
  CREATE INDEX "_claim_types_v_version_version_created_at_idx" ON "_claim_types_v" USING btree ("version_created_at");
  CREATE INDEX "_claim_types_v_created_at_idx" ON "_claim_types_v" USING btree ("created_at");
  CREATE INDEX "_claim_types_v_updated_at_idx" ON "_claim_types_v" USING btree ("updated_at");
  CREATE UNIQUE INDEX "_claim_types_v_locales_parent_id_locale_unique" ON "_claim_types_v_locales" USING btree ("_parent_id","_locale");
  CREATE INDEX "_claim_types_v_rels_order_idx" ON "_claim_types_v_rels" USING btree ("order");
  CREATE INDEX "_claim_types_v_rels_parent_idx" ON "_claim_types_v_rels" USING btree ("parent_id");
  CREATE INDEX "_claim_types_v_rels_path_idx" ON "_claim_types_v_rels" USING btree ("path");
  CREATE INDEX "_claim_types_v_rels_users_id_idx" ON "_claim_types_v_rels" USING btree ("users_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_rating_scales_fk" FOREIGN KEY ("rating_scales_id") REFERENCES "public"."rating_scales"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_claim_types_fk" FOREIGN KEY ("claim_types_id") REFERENCES "public"."claim_types"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_rating_scales_id_idx" ON "payload_locked_documents_rels" USING btree ("rating_scales_id");
  CREATE INDEX "payload_locked_documents_rels_claim_types_id_idx" ON "payload_locked_documents_rels" USING btree ("claim_types_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "rating_scales_tiers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "rating_scales_tiers_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "rating_scales_ratings" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "rating_scales_ratings_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "rating_scales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "rating_scales_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "rating_scales_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_rating_scales_v_version_tiers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_rating_scales_v_version_tiers_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_rating_scales_v_version_ratings" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_rating_scales_v_version_ratings_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_rating_scales_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_rating_scales_v_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_rating_scales_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "claim_types" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "claim_types_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "claim_types_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_claim_types_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_claim_types_v_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_claim_types_v_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE IF EXISTS "rating_scales_tiers" CASCADE;
  DROP TABLE IF EXISTS "rating_scales_tiers_locales" CASCADE;
  DROP TABLE IF EXISTS "rating_scales_ratings" CASCADE;
  DROP TABLE IF EXISTS "rating_scales_ratings_locales" CASCADE;
  DROP TABLE IF EXISTS "rating_scales" CASCADE;
  DROP TABLE IF EXISTS "rating_scales_locales" CASCADE;
  DROP TABLE IF EXISTS "rating_scales_rels" CASCADE;
  DROP TABLE IF EXISTS "_rating_scales_v_version_tiers" CASCADE;
  DROP TABLE IF EXISTS "_rating_scales_v_version_tiers_locales" CASCADE;
  DROP TABLE IF EXISTS "_rating_scales_v_version_ratings" CASCADE;
  DROP TABLE IF EXISTS "_rating_scales_v_version_ratings_locales" CASCADE;
  DROP TABLE IF EXISTS "_rating_scales_v" CASCADE;
  DROP TABLE IF EXISTS "_rating_scales_v_locales" CASCADE;
  DROP TABLE IF EXISTS "_rating_scales_v_rels" CASCADE;
  DROP TABLE IF EXISTS "claim_types" CASCADE;
  DROP TABLE IF EXISTS "claim_types_locales" CASCADE;
  DROP TABLE IF EXISTS "claim_types_rels" CASCADE;
  DROP TABLE IF EXISTS "_claim_types_v" CASCADE;
  DROP TABLE IF EXISTS "_claim_types_v_locales" CASCADE;
  DROP TABLE IF EXISTS "_claim_types_v_rels" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_rating_scales_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_claim_types_fk";
  
  DROP INDEX IF EXISTS "payload_locked_documents_rels_rating_scales_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_claim_types_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "rating_scales_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "claim_types_id";`)
}
