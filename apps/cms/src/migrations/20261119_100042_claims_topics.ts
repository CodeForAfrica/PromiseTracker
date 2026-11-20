import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_claims_extraction" AS ENUM('manual', 'import', 'ai');
  CREATE TYPE "public"."enum_claims_record_status" AS ENUM('ready', 'hold', 'archived');
  CREATE TYPE "public"."enum__claims_v_version_extraction" AS ENUM('manual', 'import', 'ai');
  CREATE TYPE "public"."enum__claims_v_version_record_status" AS ENUM('ready', 'hold', 'archived');
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'title';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'title:fr';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'title:pt';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'title:ar';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'title:sw';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'topic';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'statement';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'summary';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'summary:fr';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'summary:pt';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'summary:ar';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'summary:sw';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'saidAt';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'saidOn';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'deadline';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'deadlineText';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'deadlineText:fr';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'deadlineText:pt';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'deadlineText:ar';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'deadlineText:sw';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'sourceUrl';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'sourceLocator';
  ALTER TYPE "public"."enum_imports_record_type" ADD VALUE 'claims';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'title';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'title:fr';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'title:pt';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'title:ar';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'title:sw';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'topic';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'statement';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'summary';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'summary:fr';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'summary:pt';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'summary:ar';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'summary:sw';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'saidAt';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'saidOn';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'deadline';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'deadlineText';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'deadlineText:fr';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'deadlineText:pt';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'deadlineText:ar';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'deadlineText:sw';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'sourceUrl';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'sourceLocator';
  ALTER TYPE "public"."enum__imports_v_version_record_type" ADD VALUE 'claims';
  ALTER TYPE "public"."enum_import_mappings_record_type" ADD VALUE 'claims';
  ALTER TYPE "public"."enum__import_mappings_v_version_record_type" ADD VALUE 'claims';
  CREATE TABLE "claims" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"statement" varchar,
  	"actor_id" uuid NOT NULL,
  	"term_id" uuid,
  	"area_id" uuid,
  	"topic_id" uuid,
  	"type_id" uuid,
  	"said_at" varchar,
  	"said_on" varchar,
  	"deadline" varchar,
  	"source_url" varchar,
  	"source_locator" varchar,
  	"image_id" uuid,
  	"image_credit" varchar,
  	"slug" varchar,
  	"country_id" uuid,
  	"current_rating" varchar,
  	"rated_on" timestamp(3) with time zone,
  	"last_reviewed_at" timestamp(3) with time zone,
  	"update_count" numeric DEFAULT 0,
  	"extraction" "enum_claims_extraction" DEFAULT 'manual',
  	"confidence" numeric,
  	"entered_by_id" uuid,
  	"record_status" "enum_claims_record_status" DEFAULT 'hold' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "claims_locales" (
  	"title" varchar NOT NULL,
  	"summary" varchar,
  	"deadline_text" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" uuid NOT NULL
  );
  
  CREATE TABLE "claims_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "claims_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"actors_id" uuid,
  	"users_id" uuid
  );
  
  CREATE TABLE "_claims_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"parent_id" uuid,
  	"version_statement" varchar,
  	"version_actor_id" uuid NOT NULL,
  	"version_term_id" uuid,
  	"version_area_id" uuid,
  	"version_topic_id" uuid,
  	"version_type_id" uuid,
  	"version_said_at" varchar,
  	"version_said_on" varchar,
  	"version_deadline" varchar,
  	"version_source_url" varchar,
  	"version_source_locator" varchar,
  	"version_image_id" uuid,
  	"version_image_credit" varchar,
  	"version_slug" varchar,
  	"version_country_id" uuid,
  	"version_current_rating" varchar,
  	"version_rated_on" timestamp(3) with time zone,
  	"version_last_reviewed_at" timestamp(3) with time zone,
  	"version_update_count" numeric DEFAULT 0,
  	"version_extraction" "enum__claims_v_version_extraction" DEFAULT 'manual',
  	"version_confidence" numeric,
  	"version_entered_by_id" uuid,
  	"version_record_status" "enum__claims_v_version_record_status" DEFAULT 'hold' NOT NULL,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_claims_v_locales" (
  	"version_title" varchar NOT NULL,
  	"version_summary" varchar,
  	"version_deadline_text" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" uuid NOT NULL
  );
  
  CREATE TABLE "_claims_v_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "_claims_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"actors_id" uuid,
  	"users_id" uuid
  );
  
  CREATE TABLE "topics" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"parent_id" uuid,
  	"colour" varchar,
  	"slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "topics_locales" (
  	"name" varchar NOT NULL,
  	"description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" uuid NOT NULL
  );
  
  CREATE TABLE "topics_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" uuid
  );
  
  CREATE TABLE "_topics_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"parent_id" uuid,
  	"version_parent_id" uuid,
  	"version_colour" varchar,
  	"version_slug" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_topics_v_locales" (
  	"version_name" varchar NOT NULL,
  	"version_description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" uuid NOT NULL
  );
  
  CREATE TABLE "_topics_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" uuid
  );
  
  ALTER TABLE "actors" ADD COLUMN "key_claim_id" uuid;
  ALTER TABLE "actors_locales" ADD COLUMN "key_claim_note" varchar;
  ALTER TABLE "_actors_v" ADD COLUMN "version_key_claim_id" uuid;
  ALTER TABLE "_actors_v_locales" ADD COLUMN "version_key_claim_note" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "claims_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "topics_id" uuid;
  ALTER TABLE "site" ADD COLUMN "figures_threshold" numeric DEFAULT 20 NOT NULL;
  ALTER TABLE "site_locales" ADD COLUMN "strings_claims" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_record_so_far" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_key_claim" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_claim_who" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_claim_where" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_claim_when" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_claim_by_when" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_claim_rating" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_claim_said" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_claim_source" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_filter_rating" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_filter_topic" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_no_claims" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_figure_of" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_figures_by_country" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_claims_on_topic" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_filter_country" varchar;
  ALTER TABLE "_site_v" ADD COLUMN "version_figures_threshold" numeric DEFAULT 20 NOT NULL;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_claims" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_record_so_far" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_key_claim" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_claim_who" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_claim_where" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_claim_when" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_claim_by_when" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_claim_rating" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_claim_said" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_claim_source" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_filter_rating" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_filter_topic" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_no_claims" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_figure_of" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_figures_by_country" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_claims_on_topic" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_filter_country" varchar;
  ALTER TABLE "claims" ADD CONSTRAINT "claims_actor_id_actors_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."actors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "claims" ADD CONSTRAINT "claims_term_id_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."terms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "claims" ADD CONSTRAINT "claims_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "claims" ADD CONSTRAINT "claims_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "claims" ADD CONSTRAINT "claims_type_id_claim_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."claim_types"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "claims" ADD CONSTRAINT "claims_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "claims" ADD CONSTRAINT "claims_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "claims" ADD CONSTRAINT "claims_entered_by_id_users_id_fk" FOREIGN KEY ("entered_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "claims_locales" ADD CONSTRAINT "claims_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."claims"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "claims_texts" ADD CONSTRAINT "claims_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."claims"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "claims_rels" ADD CONSTRAINT "claims_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."claims"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "claims_rels" ADD CONSTRAINT "claims_rels_actors_fk" FOREIGN KEY ("actors_id") REFERENCES "public"."actors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "claims_rels" ADD CONSTRAINT "claims_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_claims_v" ADD CONSTRAINT "_claims_v_parent_id_claims_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."claims"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_claims_v" ADD CONSTRAINT "_claims_v_version_actor_id_actors_id_fk" FOREIGN KEY ("version_actor_id") REFERENCES "public"."actors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_claims_v" ADD CONSTRAINT "_claims_v_version_term_id_terms_id_fk" FOREIGN KEY ("version_term_id") REFERENCES "public"."terms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_claims_v" ADD CONSTRAINT "_claims_v_version_area_id_areas_id_fk" FOREIGN KEY ("version_area_id") REFERENCES "public"."areas"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_claims_v" ADD CONSTRAINT "_claims_v_version_topic_id_topics_id_fk" FOREIGN KEY ("version_topic_id") REFERENCES "public"."topics"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_claims_v" ADD CONSTRAINT "_claims_v_version_type_id_claim_types_id_fk" FOREIGN KEY ("version_type_id") REFERENCES "public"."claim_types"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_claims_v" ADD CONSTRAINT "_claims_v_version_image_id_media_id_fk" FOREIGN KEY ("version_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_claims_v" ADD CONSTRAINT "_claims_v_version_country_id_countries_id_fk" FOREIGN KEY ("version_country_id") REFERENCES "public"."countries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_claims_v" ADD CONSTRAINT "_claims_v_version_entered_by_id_users_id_fk" FOREIGN KEY ("version_entered_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_claims_v_locales" ADD CONSTRAINT "_claims_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_claims_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_claims_v_texts" ADD CONSTRAINT "_claims_v_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_claims_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_claims_v_rels" ADD CONSTRAINT "_claims_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_claims_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_claims_v_rels" ADD CONSTRAINT "_claims_v_rels_actors_fk" FOREIGN KEY ("actors_id") REFERENCES "public"."actors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_claims_v_rels" ADD CONSTRAINT "_claims_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "topics" ADD CONSTRAINT "topics_parent_id_topics_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."topics"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "topics_locales" ADD CONSTRAINT "topics_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "topics_rels" ADD CONSTRAINT "topics_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "topics_rels" ADD CONSTRAINT "topics_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_topics_v" ADD CONSTRAINT "_topics_v_parent_id_topics_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."topics"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_topics_v" ADD CONSTRAINT "_topics_v_version_parent_id_topics_id_fk" FOREIGN KEY ("version_parent_id") REFERENCES "public"."topics"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_topics_v_locales" ADD CONSTRAINT "_topics_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_topics_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_topics_v_rels" ADD CONSTRAINT "_topics_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_topics_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_topics_v_rels" ADD CONSTRAINT "_topics_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "claims_actor_idx" ON "claims" USING btree ("actor_id");
  CREATE INDEX "claims_term_idx" ON "claims" USING btree ("term_id");
  CREATE INDEX "claims_area_idx" ON "claims" USING btree ("area_id");
  CREATE INDEX "claims_topic_idx" ON "claims" USING btree ("topic_id");
  CREATE INDEX "claims_type_idx" ON "claims" USING btree ("type_id");
  CREATE INDEX "claims_said_on_idx" ON "claims" USING btree ("said_on");
  CREATE INDEX "claims_deadline_idx" ON "claims" USING btree ("deadline");
  CREATE INDEX "claims_image_idx" ON "claims" USING btree ("image_id");
  CREATE INDEX "claims_slug_idx" ON "claims" USING btree ("slug");
  CREATE INDEX "claims_country_idx" ON "claims" USING btree ("country_id");
  CREATE INDEX "claims_current_rating_idx" ON "claims" USING btree ("current_rating");
  CREATE INDEX "claims_entered_by_idx" ON "claims" USING btree ("entered_by_id");
  CREATE INDEX "claims_record_status_idx" ON "claims" USING btree ("record_status");
  CREATE INDEX "claims_updated_at_idx" ON "claims" USING btree ("updated_at");
  CREATE INDEX "claims_created_at_idx" ON "claims" USING btree ("created_at");
  CREATE UNIQUE INDEX "country_slug_3_idx" ON "claims" USING btree ("country_id","slug");
  CREATE UNIQUE INDEX "claims_locales_parent_id_locale_unique" ON "claims_locales" USING btree ("_parent_id","_locale");
  CREATE INDEX "claims_texts_order_parent" ON "claims_texts" USING btree ("order","parent_id");
  CREATE INDEX "claims_texts_text_idx" ON "claims_texts" USING btree ("text");
  CREATE INDEX "claims_rels_order_idx" ON "claims_rels" USING btree ("order");
  CREATE INDEX "claims_rels_parent_idx" ON "claims_rels" USING btree ("parent_id");
  CREATE INDEX "claims_rels_path_idx" ON "claims_rels" USING btree ("path");
  CREATE INDEX "claims_rels_actors_id_idx" ON "claims_rels" USING btree ("actors_id");
  CREATE INDEX "claims_rels_users_id_idx" ON "claims_rels" USING btree ("users_id");
  CREATE INDEX "_claims_v_parent_idx" ON "_claims_v" USING btree ("parent_id");
  CREATE INDEX "_claims_v_version_version_actor_idx" ON "_claims_v" USING btree ("version_actor_id");
  CREATE INDEX "_claims_v_version_version_term_idx" ON "_claims_v" USING btree ("version_term_id");
  CREATE INDEX "_claims_v_version_version_area_idx" ON "_claims_v" USING btree ("version_area_id");
  CREATE INDEX "_claims_v_version_version_topic_idx" ON "_claims_v" USING btree ("version_topic_id");
  CREATE INDEX "_claims_v_version_version_type_idx" ON "_claims_v" USING btree ("version_type_id");
  CREATE INDEX "_claims_v_version_version_said_on_idx" ON "_claims_v" USING btree ("version_said_on");
  CREATE INDEX "_claims_v_version_version_deadline_idx" ON "_claims_v" USING btree ("version_deadline");
  CREATE INDEX "_claims_v_version_version_image_idx" ON "_claims_v" USING btree ("version_image_id");
  CREATE INDEX "_claims_v_version_version_slug_idx" ON "_claims_v" USING btree ("version_slug");
  CREATE INDEX "_claims_v_version_version_country_idx" ON "_claims_v" USING btree ("version_country_id");
  CREATE INDEX "_claims_v_version_version_current_rating_idx" ON "_claims_v" USING btree ("version_current_rating");
  CREATE INDEX "_claims_v_version_version_entered_by_idx" ON "_claims_v" USING btree ("version_entered_by_id");
  CREATE INDEX "_claims_v_version_version_record_status_idx" ON "_claims_v" USING btree ("version_record_status");
  CREATE INDEX "_claims_v_version_version_updated_at_idx" ON "_claims_v" USING btree ("version_updated_at");
  CREATE INDEX "_claims_v_version_version_created_at_idx" ON "_claims_v" USING btree ("version_created_at");
  CREATE INDEX "_claims_v_created_at_idx" ON "_claims_v" USING btree ("created_at");
  CREATE INDEX "_claims_v_updated_at_idx" ON "_claims_v" USING btree ("updated_at");
  CREATE INDEX "version_country_version_slug_3_idx" ON "_claims_v" USING btree ("version_country_id","version_slug");
  CREATE UNIQUE INDEX "_claims_v_locales_parent_id_locale_unique" ON "_claims_v_locales" USING btree ("_parent_id","_locale");
  CREATE INDEX "_claims_v_texts_order_parent" ON "_claims_v_texts" USING btree ("order","parent_id");
  CREATE INDEX "_claims_v_rels_order_idx" ON "_claims_v_rels" USING btree ("order");
  CREATE INDEX "_claims_v_rels_parent_idx" ON "_claims_v_rels" USING btree ("parent_id");
  CREATE INDEX "_claims_v_rels_path_idx" ON "_claims_v_rels" USING btree ("path");
  CREATE INDEX "_claims_v_rels_actors_id_idx" ON "_claims_v_rels" USING btree ("actors_id");
  CREATE INDEX "_claims_v_rels_users_id_idx" ON "_claims_v_rels" USING btree ("users_id");
  CREATE INDEX "topics_parent_idx" ON "topics" USING btree ("parent_id");
  CREATE INDEX "topics_parent_1_idx" ON "topics" USING btree ("parent_id");
  CREATE UNIQUE INDEX "topics_slug_idx" ON "topics" USING btree ("slug");
  CREATE INDEX "topics_updated_at_idx" ON "topics" USING btree ("updated_at");
  CREATE INDEX "topics_created_at_idx" ON "topics" USING btree ("created_at");
  CREATE UNIQUE INDEX "topics_locales_parent_id_locale_unique" ON "topics_locales" USING btree ("_parent_id","_locale");
  CREATE INDEX "topics_rels_order_idx" ON "topics_rels" USING btree ("order");
  CREATE INDEX "topics_rels_parent_idx" ON "topics_rels" USING btree ("parent_id");
  CREATE INDEX "topics_rels_path_idx" ON "topics_rels" USING btree ("path");
  CREATE INDEX "topics_rels_users_id_idx" ON "topics_rels" USING btree ("users_id");
  CREATE INDEX "_topics_v_parent_idx" ON "_topics_v" USING btree ("parent_id");
  CREATE INDEX "_topics_v_version_version_parent_idx" ON "_topics_v" USING btree ("version_parent_id");
  CREATE INDEX "_topics_v_version_version_parent_1_idx" ON "_topics_v" USING btree ("version_parent_id");
  CREATE INDEX "_topics_v_version_version_slug_idx" ON "_topics_v" USING btree ("version_slug");
  CREATE INDEX "_topics_v_version_version_updated_at_idx" ON "_topics_v" USING btree ("version_updated_at");
  CREATE INDEX "_topics_v_version_version_created_at_idx" ON "_topics_v" USING btree ("version_created_at");
  CREATE INDEX "_topics_v_created_at_idx" ON "_topics_v" USING btree ("created_at");
  CREATE INDEX "_topics_v_updated_at_idx" ON "_topics_v" USING btree ("updated_at");
  CREATE UNIQUE INDEX "_topics_v_locales_parent_id_locale_unique" ON "_topics_v_locales" USING btree ("_parent_id","_locale");
  CREATE INDEX "_topics_v_rels_order_idx" ON "_topics_v_rels" USING btree ("order");
  CREATE INDEX "_topics_v_rels_parent_idx" ON "_topics_v_rels" USING btree ("parent_id");
  CREATE INDEX "_topics_v_rels_path_idx" ON "_topics_v_rels" USING btree ("path");
  CREATE INDEX "_topics_v_rels_users_id_idx" ON "_topics_v_rels" USING btree ("users_id");
  ALTER TABLE "actors" ADD CONSTRAINT "actors_key_claim_id_claims_id_fk" FOREIGN KEY ("key_claim_id") REFERENCES "public"."claims"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_actors_v" ADD CONSTRAINT "_actors_v_version_key_claim_id_claims_id_fk" FOREIGN KEY ("version_key_claim_id") REFERENCES "public"."claims"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_claims_fk" FOREIGN KEY ("claims_id") REFERENCES "public"."claims"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_topics_fk" FOREIGN KEY ("topics_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "actors_key_claim_idx" ON "actors" USING btree ("key_claim_id");
  CREATE INDEX "_actors_v_version_version_key_claim_idx" ON "_actors_v" USING btree ("version_key_claim_id");
  CREATE INDEX "payload_locked_documents_rels_claims_id_idx" ON "payload_locked_documents_rels" USING btree ("claims_id");
  CREATE INDEX "payload_locked_documents_rels_topics_id_idx" ON "payload_locked_documents_rels" USING btree ("topics_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "claims" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "claims_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "claims_texts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "claims_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_claims_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_claims_v_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_claims_v_texts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_claims_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "topics" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "topics_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "topics_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_topics_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_topics_v_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_topics_v_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE IF EXISTS "claims" CASCADE;
  DROP TABLE IF EXISTS "claims_locales" CASCADE;
  DROP TABLE IF EXISTS "claims_texts" CASCADE;
  DROP TABLE IF EXISTS "claims_rels" CASCADE;
  DROP TABLE IF EXISTS "_claims_v" CASCADE;
  DROP TABLE IF EXISTS "_claims_v_locales" CASCADE;
  DROP TABLE IF EXISTS "_claims_v_texts" CASCADE;
  DROP TABLE IF EXISTS "_claims_v_rels" CASCADE;
  DROP TABLE IF EXISTS "topics" CASCADE;
  DROP TABLE IF EXISTS "topics_locales" CASCADE;
  DROP TABLE IF EXISTS "topics_rels" CASCADE;
  DROP TABLE IF EXISTS "_topics_v" CASCADE;
  DROP TABLE IF EXISTS "_topics_v_locales" CASCADE;
  DROP TABLE IF EXISTS "_topics_v_rels" CASCADE;
  ALTER TABLE "actors" DROP CONSTRAINT IF EXISTS "actors_key_claim_id_claims_id_fk";
  
  ALTER TABLE "_actors_v" DROP CONSTRAINT IF EXISTS "_actors_v_version_key_claim_id_claims_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_claims_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_topics_fk";
  
  ALTER TABLE "imports_mapping" ALTER COLUMN "field" SET DATA TYPE text;
  DROP TYPE "public"."enum_imports_mapping_field";
  CREATE TYPE "public"."enum_imports_mapping_field" AS ENUM('name', 'name:fr', 'name:pt', 'name:ar', 'name:sw', 'slug', 'type', 'parent', 'page', 'externalCode', 'shortName', 'shortName:fr', 'shortName:pt', 'shortName:ar', 'shortName:sw', 'areaType', 'holdersPerSeat', 'order', 'kind', 'honorific', 'gender', 'institutionType', 'imageCredit', 'biography', 'biography:fr', 'biography:pt', 'biography:ar', 'biography:sw', 'actor', 'office', 'area', 'party', 'electedOn', 'startsOn', 'endsOn', 'successor', 'closingSummary', 'closingSummary:fr', 'closingSummary:pt', 'closingSummary:ar', 'closingSummary:sw');
  ALTER TABLE "imports_mapping" ALTER COLUMN "field" SET DATA TYPE "public"."enum_imports_mapping_field" USING "field"::"public"."enum_imports_mapping_field";
  ALTER TABLE "imports" ALTER COLUMN "record_type" SET DATA TYPE text;
  DROP TYPE "public"."enum_imports_record_type";
  CREATE TYPE "public"."enum_imports_record_type" AS ENUM('areas', 'offices', 'actors', 'terms');
  ALTER TABLE "imports" ALTER COLUMN "record_type" SET DATA TYPE "public"."enum_imports_record_type" USING "record_type"::"public"."enum_imports_record_type";
  ALTER TABLE "_imports_v_version_mapping" ALTER COLUMN "field" SET DATA TYPE text;
  DROP TYPE "public"."enum__imports_v_version_mapping_field";
  CREATE TYPE "public"."enum__imports_v_version_mapping_field" AS ENUM('name', 'name:fr', 'name:pt', 'name:ar', 'name:sw', 'slug', 'type', 'parent', 'page', 'externalCode', 'shortName', 'shortName:fr', 'shortName:pt', 'shortName:ar', 'shortName:sw', 'areaType', 'holdersPerSeat', 'order', 'kind', 'honorific', 'gender', 'institutionType', 'imageCredit', 'biography', 'biography:fr', 'biography:pt', 'biography:ar', 'biography:sw', 'actor', 'office', 'area', 'party', 'electedOn', 'startsOn', 'endsOn', 'successor', 'closingSummary', 'closingSummary:fr', 'closingSummary:pt', 'closingSummary:ar', 'closingSummary:sw');
  ALTER TABLE "_imports_v_version_mapping" ALTER COLUMN "field" SET DATA TYPE "public"."enum__imports_v_version_mapping_field" USING "field"::"public"."enum__imports_v_version_mapping_field";
  ALTER TABLE "_imports_v" ALTER COLUMN "version_record_type" SET DATA TYPE text;
  DROP TYPE "public"."enum__imports_v_version_record_type";
  CREATE TYPE "public"."enum__imports_v_version_record_type" AS ENUM('areas', 'offices', 'actors', 'terms');
  ALTER TABLE "_imports_v" ALTER COLUMN "version_record_type" SET DATA TYPE "public"."enum__imports_v_version_record_type" USING "version_record_type"::"public"."enum__imports_v_version_record_type";
  ALTER TABLE "import_mappings" ALTER COLUMN "record_type" SET DATA TYPE text;
  DROP TYPE "public"."enum_import_mappings_record_type";
  CREATE TYPE "public"."enum_import_mappings_record_type" AS ENUM('areas', 'offices', 'actors', 'terms');
  ALTER TABLE "import_mappings" ALTER COLUMN "record_type" SET DATA TYPE "public"."enum_import_mappings_record_type" USING "record_type"::"public"."enum_import_mappings_record_type";
  ALTER TABLE "_import_mappings_v" ALTER COLUMN "version_record_type" SET DATA TYPE text;
  DROP TYPE "public"."enum__import_mappings_v_version_record_type";
  CREATE TYPE "public"."enum__import_mappings_v_version_record_type" AS ENUM('areas', 'offices', 'actors', 'terms');
  ALTER TABLE "_import_mappings_v" ALTER COLUMN "version_record_type" SET DATA TYPE "public"."enum__import_mappings_v_version_record_type" USING "version_record_type"::"public"."enum__import_mappings_v_version_record_type";
  DROP INDEX IF EXISTS "actors_key_claim_idx";
  DROP INDEX IF EXISTS "_actors_v_version_version_key_claim_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_claims_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_topics_id_idx";
  ALTER TABLE "actors" DROP COLUMN "key_claim_id";
  ALTER TABLE "actors_locales" DROP COLUMN "key_claim_note";
  ALTER TABLE "_actors_v" DROP COLUMN "version_key_claim_id";
  ALTER TABLE "_actors_v_locales" DROP COLUMN "version_key_claim_note";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "claims_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "topics_id";
  ALTER TABLE "site" DROP COLUMN "figures_threshold";
  ALTER TABLE "site_locales" DROP COLUMN "strings_claims";
  ALTER TABLE "site_locales" DROP COLUMN "strings_record_so_far";
  ALTER TABLE "site_locales" DROP COLUMN "strings_key_claim";
  ALTER TABLE "site_locales" DROP COLUMN "strings_claim_who";
  ALTER TABLE "site_locales" DROP COLUMN "strings_claim_where";
  ALTER TABLE "site_locales" DROP COLUMN "strings_claim_when";
  ALTER TABLE "site_locales" DROP COLUMN "strings_claim_by_when";
  ALTER TABLE "site_locales" DROP COLUMN "strings_claim_rating";
  ALTER TABLE "site_locales" DROP COLUMN "strings_claim_said";
  ALTER TABLE "site_locales" DROP COLUMN "strings_claim_source";
  ALTER TABLE "site_locales" DROP COLUMN "strings_filter_rating";
  ALTER TABLE "site_locales" DROP COLUMN "strings_filter_topic";
  ALTER TABLE "site_locales" DROP COLUMN "strings_no_claims";
  ALTER TABLE "site_locales" DROP COLUMN "strings_figure_of";
  ALTER TABLE "site_locales" DROP COLUMN "strings_figures_by_country";
  ALTER TABLE "site_locales" DROP COLUMN "strings_claims_on_topic";
  ALTER TABLE "site_locales" DROP COLUMN "strings_filter_country";
  ALTER TABLE "_site_v" DROP COLUMN "version_figures_threshold";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_claims";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_record_so_far";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_key_claim";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_claim_who";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_claim_where";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_claim_when";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_claim_by_when";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_claim_rating";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_claim_said";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_claim_source";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_filter_rating";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_filter_topic";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_no_claims";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_figure_of";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_figures_by_country";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_claims_on_topic";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_filter_country";
  DROP TYPE "public"."enum_claims_extraction";
  DROP TYPE "public"."enum_claims_record_status";
  DROP TYPE "public"."enum__claims_v_version_extraction";
  DROP TYPE "public"."enum__claims_v_version_record_status";`)
}
