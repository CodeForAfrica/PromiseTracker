import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_actors_links_type" AS ENUM('website', 'facebook', 'x', 'instagram', 'youtube', 'tiktok', 'linkedin', 'other');
  CREATE TYPE "public"."enum_actors_kind" AS ENUM('person', 'party', 'institution');
  CREATE TYPE "public"."enum_actors_gender" AS ENUM('female', 'male', 'non-binary');
  CREATE TYPE "public"."enum_actors_institution_type" AS ENUM('ministry', 'agency', 'department', 'commission', 'state-corporation', 'other');
  CREATE TYPE "public"."enum_actors_record_status" AS ENUM('ready', 'hold', 'archived');
  CREATE TYPE "public"."enum__actors_v_version_links_type" AS ENUM('website', 'facebook', 'x', 'instagram', 'youtube', 'tiktok', 'linkedin', 'other');
  CREATE TYPE "public"."enum__actors_v_version_kind" AS ENUM('person', 'party', 'institution');
  CREATE TYPE "public"."enum__actors_v_version_gender" AS ENUM('female', 'male', 'non-binary');
  CREATE TYPE "public"."enum__actors_v_version_institution_type" AS ENUM('ministry', 'agency', 'department', 'commission', 'state-corporation', 'other');
  CREATE TYPE "public"."enum__actors_v_version_record_status" AS ENUM('ready', 'hold', 'archived');
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'kind';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'honorific';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'gender';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'institutionType';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'imageCredit';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'biography';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'biography:fr';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'biography:pt';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'biography:ar';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'biography:sw';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'actor';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'office';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'area';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'party';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'electedOn';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'startsOn';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'endsOn';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'successor';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'closingSummary';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'closingSummary:fr';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'closingSummary:pt';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'closingSummary:ar';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'closingSummary:sw';
  ALTER TYPE "public"."enum_imports_record_type" ADD VALUE 'actors';
  ALTER TYPE "public"."enum_imports_record_type" ADD VALUE 'terms';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'kind';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'honorific';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'gender';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'institutionType';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'imageCredit';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'biography';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'biography:fr';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'biography:pt';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'biography:ar';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'biography:sw';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'actor';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'office';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'area';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'party';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'electedOn';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'startsOn';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'endsOn';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'successor';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'closingSummary';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'closingSummary:fr';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'closingSummary:pt';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'closingSummary:ar';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'closingSummary:sw';
  ALTER TYPE "public"."enum__imports_v_version_record_type" ADD VALUE 'actors';
  ALTER TYPE "public"."enum__imports_v_version_record_type" ADD VALUE 'terms';
  ALTER TYPE "public"."enum_import_mappings_record_type" ADD VALUE 'actors';
  ALTER TYPE "public"."enum_import_mappings_record_type" ADD VALUE 'terms';
  ALTER TYPE "public"."enum__import_mappings_v_version_record_type" ADD VALUE 'actors';
  ALTER TYPE "public"."enum__import_mappings_v_version_record_type" ADD VALUE 'terms';
  CREATE TABLE "actors_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"type" "enum_actors_links_type" DEFAULT 'website' NOT NULL,
  	"url" varchar NOT NULL
  );
  
  CREATE TABLE "actors" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"name" varchar NOT NULL,
  	"kind" "enum_actors_kind" DEFAULT 'person' NOT NULL,
  	"short_name" varchar,
  	"honorific" varchar,
  	"gender" "enum_actors_gender",
  	"institution_type" "enum_actors_institution_type",
  	"image_id" uuid,
  	"image_credit" varchar,
  	"slug" varchar,
  	"country_id" uuid NOT NULL,
  	"on_record_since" timestamp(3) with time zone,
  	"record_status" "enum_actors_record_status" DEFAULT 'hold' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "actors_locales" (
  	"biography" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" uuid NOT NULL
  );
  
  CREATE TABLE "actors_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "actors_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" uuid
  );
  
  CREATE TABLE "_actors_v_version_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"type" "enum__actors_v_version_links_type" DEFAULT 'website' NOT NULL,
  	"url" varchar NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_actors_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"parent_id" uuid,
  	"version_name" varchar NOT NULL,
  	"version_kind" "enum__actors_v_version_kind" DEFAULT 'person' NOT NULL,
  	"version_short_name" varchar,
  	"version_honorific" varchar,
  	"version_gender" "enum__actors_v_version_gender",
  	"version_institution_type" "enum__actors_v_version_institution_type",
  	"version_image_id" uuid,
  	"version_image_credit" varchar,
  	"version_slug" varchar,
  	"version_country_id" uuid NOT NULL,
  	"version_on_record_since" timestamp(3) with time zone,
  	"version_record_status" "enum__actors_v_version_record_status" DEFAULT 'hold' NOT NULL,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_actors_v_locales" (
  	"version_biography" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" uuid NOT NULL
  );
  
  CREATE TABLE "_actors_v_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "_actors_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" uuid
  );
  
  CREATE TABLE "terms" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"actor_id" uuid NOT NULL,
  	"office_id" uuid NOT NULL,
  	"area_id" uuid,
  	"party_id" uuid,
  	"elected_on" timestamp(3) with time zone,
  	"starts_on" timestamp(3) with time zone NOT NULL,
  	"ends_on" timestamp(3) with time zone,
  	"successor_id" uuid,
  	"title" varchar,
  	"country_id" uuid,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "terms_locales" (
  	"closing_summary" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" uuid NOT NULL
  );
  
  CREATE TABLE "terms_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" uuid
  );
  
  CREATE TABLE "_terms_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"parent_id" uuid,
  	"version_actor_id" uuid NOT NULL,
  	"version_office_id" uuid NOT NULL,
  	"version_area_id" uuid,
  	"version_party_id" uuid,
  	"version_elected_on" timestamp(3) with time zone,
  	"version_starts_on" timestamp(3) with time zone NOT NULL,
  	"version_ends_on" timestamp(3) with time zone,
  	"version_successor_id" uuid,
  	"version_title" varchar,
  	"version_country_id" uuid,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_terms_v_locales" (
  	"version_closing_summary" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" uuid NOT NULL
  );
  
  CREATE TABLE "_terms_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" uuid
  );
  
  CREATE TABLE "offices_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "_offices_v_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  DROP INDEX "country_slug_idx";
  DROP INDEX "version_country_version_slug_idx";
  DROP INDEX "country_slug_1_idx";
  DROP INDEX "version_country_version_slug_1_idx";
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "actors_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "terms_id" uuid;
  ALTER TABLE "site_locales" ADD COLUMN "strings_officials" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_see_all_officials" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_who_is_delivering" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_past_administrations" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_who_this_is" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_time_in_office" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_present" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_closing_summary" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_succeeded_by" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_former_holder" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_no_holder" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_links" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_photo_credit" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_filter_office" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_filter_area" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_filter_party" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_filter_all" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_sort_by" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_sort_name" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_sort_office" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_show_results" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_no_matches" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_next_page" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_officials" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_see_all_officials" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_who_is_delivering" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_past_administrations" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_who_this_is" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_time_in_office" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_present" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_closing_summary" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_succeeded_by" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_former_holder" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_no_holder" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_links" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_photo_credit" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_filter_office" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_filter_area" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_filter_party" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_filter_all" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_sort_by" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_sort_name" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_sort_office" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_show_results" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_no_matches" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_next_page" varchar;
  ALTER TABLE "actors_links" ADD CONSTRAINT "actors_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."actors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "actors" ADD CONSTRAINT "actors_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "actors" ADD CONSTRAINT "actors_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "actors_locales" ADD CONSTRAINT "actors_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."actors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "actors_texts" ADD CONSTRAINT "actors_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."actors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "actors_rels" ADD CONSTRAINT "actors_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."actors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "actors_rels" ADD CONSTRAINT "actors_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_actors_v_version_links" ADD CONSTRAINT "_actors_v_version_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_actors_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_actors_v" ADD CONSTRAINT "_actors_v_parent_id_actors_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."actors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_actors_v" ADD CONSTRAINT "_actors_v_version_image_id_media_id_fk" FOREIGN KEY ("version_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_actors_v" ADD CONSTRAINT "_actors_v_version_country_id_countries_id_fk" FOREIGN KEY ("version_country_id") REFERENCES "public"."countries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_actors_v_locales" ADD CONSTRAINT "_actors_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_actors_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_actors_v_texts" ADD CONSTRAINT "_actors_v_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_actors_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_actors_v_rels" ADD CONSTRAINT "_actors_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_actors_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_actors_v_rels" ADD CONSTRAINT "_actors_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "terms" ADD CONSTRAINT "terms_actor_id_actors_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."actors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "terms" ADD CONSTRAINT "terms_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "terms" ADD CONSTRAINT "terms_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "terms" ADD CONSTRAINT "terms_party_id_actors_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."actors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "terms" ADD CONSTRAINT "terms_successor_id_actors_id_fk" FOREIGN KEY ("successor_id") REFERENCES "public"."actors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "terms" ADD CONSTRAINT "terms_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "terms_locales" ADD CONSTRAINT "terms_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."terms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "terms_rels" ADD CONSTRAINT "terms_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."terms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "terms_rels" ADD CONSTRAINT "terms_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_terms_v" ADD CONSTRAINT "_terms_v_parent_id_terms_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."terms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_terms_v" ADD CONSTRAINT "_terms_v_version_actor_id_actors_id_fk" FOREIGN KEY ("version_actor_id") REFERENCES "public"."actors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_terms_v" ADD CONSTRAINT "_terms_v_version_office_id_offices_id_fk" FOREIGN KEY ("version_office_id") REFERENCES "public"."offices"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_terms_v" ADD CONSTRAINT "_terms_v_version_area_id_areas_id_fk" FOREIGN KEY ("version_area_id") REFERENCES "public"."areas"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_terms_v" ADD CONSTRAINT "_terms_v_version_party_id_actors_id_fk" FOREIGN KEY ("version_party_id") REFERENCES "public"."actors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_terms_v" ADD CONSTRAINT "_terms_v_version_successor_id_actors_id_fk" FOREIGN KEY ("version_successor_id") REFERENCES "public"."actors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_terms_v" ADD CONSTRAINT "_terms_v_version_country_id_countries_id_fk" FOREIGN KEY ("version_country_id") REFERENCES "public"."countries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_terms_v_locales" ADD CONSTRAINT "_terms_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_terms_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_terms_v_rels" ADD CONSTRAINT "_terms_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_terms_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_terms_v_rels" ADD CONSTRAINT "_terms_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "offices_texts" ADD CONSTRAINT "offices_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."offices"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_offices_v_texts" ADD CONSTRAINT "_offices_v_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_offices_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "actors_links_order_idx" ON "actors_links" USING btree ("_order");
  CREATE INDEX "actors_links_parent_id_idx" ON "actors_links" USING btree ("_parent_id");
  CREATE INDEX "actors_image_idx" ON "actors" USING btree ("image_id");
  CREATE INDEX "actors_slug_idx" ON "actors" USING btree ("slug");
  CREATE INDEX "actors_country_idx" ON "actors" USING btree ("country_id");
  CREATE INDEX "actors_on_record_since_idx" ON "actors" USING btree ("on_record_since");
  CREATE INDEX "actors_record_status_idx" ON "actors" USING btree ("record_status");
  CREATE INDEX "actors_updated_at_idx" ON "actors" USING btree ("updated_at");
  CREATE INDEX "actors_created_at_idx" ON "actors" USING btree ("created_at");
  CREATE UNIQUE INDEX "country_slug_idx" ON "actors" USING btree ("country_id","slug");
  CREATE UNIQUE INDEX "actors_locales_parent_id_locale_unique" ON "actors_locales" USING btree ("_parent_id","_locale");
  CREATE INDEX "actors_texts_order_parent" ON "actors_texts" USING btree ("order","parent_id");
  CREATE INDEX "actors_texts_text_idx" ON "actors_texts" USING btree ("text");
  CREATE INDEX "actors_rels_order_idx" ON "actors_rels" USING btree ("order");
  CREATE INDEX "actors_rels_parent_idx" ON "actors_rels" USING btree ("parent_id");
  CREATE INDEX "actors_rels_path_idx" ON "actors_rels" USING btree ("path");
  CREATE INDEX "actors_rels_users_id_idx" ON "actors_rels" USING btree ("users_id");
  CREATE INDEX "_actors_v_version_links_order_idx" ON "_actors_v_version_links" USING btree ("_order");
  CREATE INDEX "_actors_v_version_links_parent_id_idx" ON "_actors_v_version_links" USING btree ("_parent_id");
  CREATE INDEX "_actors_v_parent_idx" ON "_actors_v" USING btree ("parent_id");
  CREATE INDEX "_actors_v_version_version_image_idx" ON "_actors_v" USING btree ("version_image_id");
  CREATE INDEX "_actors_v_version_version_slug_idx" ON "_actors_v" USING btree ("version_slug");
  CREATE INDEX "_actors_v_version_version_country_idx" ON "_actors_v" USING btree ("version_country_id");
  CREATE INDEX "_actors_v_version_version_on_record_since_idx" ON "_actors_v" USING btree ("version_on_record_since");
  CREATE INDEX "_actors_v_version_version_record_status_idx" ON "_actors_v" USING btree ("version_record_status");
  CREATE INDEX "_actors_v_version_version_updated_at_idx" ON "_actors_v" USING btree ("version_updated_at");
  CREATE INDEX "_actors_v_version_version_created_at_idx" ON "_actors_v" USING btree ("version_created_at");
  CREATE INDEX "_actors_v_created_at_idx" ON "_actors_v" USING btree ("created_at");
  CREATE INDEX "_actors_v_updated_at_idx" ON "_actors_v" USING btree ("updated_at");
  CREATE INDEX "version_country_version_slug_idx" ON "_actors_v" USING btree ("version_country_id","version_slug");
  CREATE UNIQUE INDEX "_actors_v_locales_parent_id_locale_unique" ON "_actors_v_locales" USING btree ("_parent_id","_locale");
  CREATE INDEX "_actors_v_texts_order_parent" ON "_actors_v_texts" USING btree ("order","parent_id");
  CREATE INDEX "_actors_v_rels_order_idx" ON "_actors_v_rels" USING btree ("order");
  CREATE INDEX "_actors_v_rels_parent_idx" ON "_actors_v_rels" USING btree ("parent_id");
  CREATE INDEX "_actors_v_rels_path_idx" ON "_actors_v_rels" USING btree ("path");
  CREATE INDEX "_actors_v_rels_users_id_idx" ON "_actors_v_rels" USING btree ("users_id");
  CREATE INDEX "terms_actor_idx" ON "terms" USING btree ("actor_id");
  CREATE INDEX "terms_office_idx" ON "terms" USING btree ("office_id");
  CREATE INDEX "terms_area_idx" ON "terms" USING btree ("area_id");
  CREATE INDEX "terms_party_idx" ON "terms" USING btree ("party_id");
  CREATE INDEX "terms_starts_on_idx" ON "terms" USING btree ("starts_on");
  CREATE INDEX "terms_ends_on_idx" ON "terms" USING btree ("ends_on");
  CREATE INDEX "terms_successor_idx" ON "terms" USING btree ("successor_id");
  CREATE INDEX "terms_country_idx" ON "terms" USING btree ("country_id");
  CREATE INDEX "terms_updated_at_idx" ON "terms" USING btree ("updated_at");
  CREATE INDEX "terms_created_at_idx" ON "terms" USING btree ("created_at");
  CREATE UNIQUE INDEX "terms_locales_parent_id_locale_unique" ON "terms_locales" USING btree ("_parent_id","_locale");
  CREATE INDEX "terms_rels_order_idx" ON "terms_rels" USING btree ("order");
  CREATE INDEX "terms_rels_parent_idx" ON "terms_rels" USING btree ("parent_id");
  CREATE INDEX "terms_rels_path_idx" ON "terms_rels" USING btree ("path");
  CREATE INDEX "terms_rels_users_id_idx" ON "terms_rels" USING btree ("users_id");
  CREATE INDEX "_terms_v_parent_idx" ON "_terms_v" USING btree ("parent_id");
  CREATE INDEX "_terms_v_version_version_actor_idx" ON "_terms_v" USING btree ("version_actor_id");
  CREATE INDEX "_terms_v_version_version_office_idx" ON "_terms_v" USING btree ("version_office_id");
  CREATE INDEX "_terms_v_version_version_area_idx" ON "_terms_v" USING btree ("version_area_id");
  CREATE INDEX "_terms_v_version_version_party_idx" ON "_terms_v" USING btree ("version_party_id");
  CREATE INDEX "_terms_v_version_version_starts_on_idx" ON "_terms_v" USING btree ("version_starts_on");
  CREATE INDEX "_terms_v_version_version_ends_on_idx" ON "_terms_v" USING btree ("version_ends_on");
  CREATE INDEX "_terms_v_version_version_successor_idx" ON "_terms_v" USING btree ("version_successor_id");
  CREATE INDEX "_terms_v_version_version_country_idx" ON "_terms_v" USING btree ("version_country_id");
  CREATE INDEX "_terms_v_version_version_updated_at_idx" ON "_terms_v" USING btree ("version_updated_at");
  CREATE INDEX "_terms_v_version_version_created_at_idx" ON "_terms_v" USING btree ("version_created_at");
  CREATE INDEX "_terms_v_created_at_idx" ON "_terms_v" USING btree ("created_at");
  CREATE INDEX "_terms_v_updated_at_idx" ON "_terms_v" USING btree ("updated_at");
  CREATE UNIQUE INDEX "_terms_v_locales_parent_id_locale_unique" ON "_terms_v_locales" USING btree ("_parent_id","_locale");
  CREATE INDEX "_terms_v_rels_order_idx" ON "_terms_v_rels" USING btree ("order");
  CREATE INDEX "_terms_v_rels_parent_idx" ON "_terms_v_rels" USING btree ("parent_id");
  CREATE INDEX "_terms_v_rels_path_idx" ON "_terms_v_rels" USING btree ("path");
  CREATE INDEX "_terms_v_rels_users_id_idx" ON "_terms_v_rels" USING btree ("users_id");
  CREATE INDEX "offices_texts_order_parent" ON "offices_texts" USING btree ("order","parent_id");
  CREATE INDEX "_offices_v_texts_order_parent" ON "_offices_v_texts" USING btree ("order","parent_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_actors_fk" FOREIGN KEY ("actors_id") REFERENCES "public"."actors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_terms_fk" FOREIGN KEY ("terms_id") REFERENCES "public"."terms"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "country_slug_1_idx" ON "areas" USING btree ("country_id","slug");
  CREATE INDEX "version_country_version_slug_1_idx" ON "_areas_v" USING btree ("version_country_id","version_slug");
  CREATE UNIQUE INDEX "country_slug_2_idx" ON "offices" USING btree ("country_id","slug");
  CREATE INDEX "version_country_version_slug_2_idx" ON "_offices_v" USING btree ("version_country_id","version_slug");
  CREATE INDEX "payload_locked_documents_rels_actors_id_idx" ON "payload_locked_documents_rels" USING btree ("actors_id");
  CREATE INDEX "payload_locked_documents_rels_terms_id_idx" ON "payload_locked_documents_rels" USING btree ("terms_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "actors_links" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "actors" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "actors_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "actors_texts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "actors_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_actors_v_version_links" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_actors_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_actors_v_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_actors_v_texts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_actors_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "terms" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "terms_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "terms_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_terms_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_terms_v_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_terms_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "offices_texts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_offices_v_texts" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "actors_links" CASCADE;
  DROP TABLE "actors" CASCADE;
  DROP TABLE "actors_locales" CASCADE;
  DROP TABLE "actors_texts" CASCADE;
  DROP TABLE "actors_rels" CASCADE;
  DROP TABLE "_actors_v_version_links" CASCADE;
  DROP TABLE "_actors_v" CASCADE;
  DROP TABLE "_actors_v_locales" CASCADE;
  DROP TABLE "_actors_v_texts" CASCADE;
  DROP TABLE "_actors_v_rels" CASCADE;
  DROP TABLE "terms" CASCADE;
  DROP TABLE "terms_locales" CASCADE;
  DROP TABLE "terms_rels" CASCADE;
  DROP TABLE "_terms_v" CASCADE;
  DROP TABLE "_terms_v_locales" CASCADE;
  DROP TABLE "_terms_v_rels" CASCADE;
  DROP TABLE "offices_texts" CASCADE;
  DROP TABLE "_offices_v_texts" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_actors_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_terms_fk";
  
  ALTER TABLE "imports_mapping" ALTER COLUMN "field" SET DATA TYPE text;
  DROP TYPE "public"."enum_imports_mapping_field";
  CREATE TYPE "public"."enum_imports_mapping_field" AS ENUM('name', 'name:fr', 'name:pt', 'name:ar', 'name:sw', 'slug', 'type', 'parent', 'page', 'externalCode', 'shortName', 'shortName:fr', 'shortName:pt', 'shortName:ar', 'shortName:sw', 'areaType', 'holdersPerSeat', 'order');
  ALTER TABLE "imports_mapping" ALTER COLUMN "field" SET DATA TYPE "public"."enum_imports_mapping_field" USING "field"::"public"."enum_imports_mapping_field";
  ALTER TABLE "imports" ALTER COLUMN "record_type" SET DATA TYPE text;
  DROP TYPE "public"."enum_imports_record_type";
  CREATE TYPE "public"."enum_imports_record_type" AS ENUM('areas', 'offices');
  ALTER TABLE "imports" ALTER COLUMN "record_type" SET DATA TYPE "public"."enum_imports_record_type" USING "record_type"::"public"."enum_imports_record_type";
  ALTER TABLE "_imports_v_version_mapping" ALTER COLUMN "field" SET DATA TYPE text;
  DROP TYPE "public"."enum__imports_v_version_mapping_field";
  CREATE TYPE "public"."enum__imports_v_version_mapping_field" AS ENUM('name', 'name:fr', 'name:pt', 'name:ar', 'name:sw', 'slug', 'type', 'parent', 'page', 'externalCode', 'shortName', 'shortName:fr', 'shortName:pt', 'shortName:ar', 'shortName:sw', 'areaType', 'holdersPerSeat', 'order');
  ALTER TABLE "_imports_v_version_mapping" ALTER COLUMN "field" SET DATA TYPE "public"."enum__imports_v_version_mapping_field" USING "field"::"public"."enum__imports_v_version_mapping_field";
  ALTER TABLE "_imports_v" ALTER COLUMN "version_record_type" SET DATA TYPE text;
  DROP TYPE "public"."enum__imports_v_version_record_type";
  CREATE TYPE "public"."enum__imports_v_version_record_type" AS ENUM('areas', 'offices');
  ALTER TABLE "_imports_v" ALTER COLUMN "version_record_type" SET DATA TYPE "public"."enum__imports_v_version_record_type" USING "version_record_type"::"public"."enum__imports_v_version_record_type";
  ALTER TABLE "import_mappings" ALTER COLUMN "record_type" SET DATA TYPE text;
  DROP TYPE "public"."enum_import_mappings_record_type";
  CREATE TYPE "public"."enum_import_mappings_record_type" AS ENUM('areas', 'offices');
  ALTER TABLE "import_mappings" ALTER COLUMN "record_type" SET DATA TYPE "public"."enum_import_mappings_record_type" USING "record_type"::"public"."enum_import_mappings_record_type";
  ALTER TABLE "_import_mappings_v" ALTER COLUMN "version_record_type" SET DATA TYPE text;
  DROP TYPE "public"."enum__import_mappings_v_version_record_type";
  CREATE TYPE "public"."enum__import_mappings_v_version_record_type" AS ENUM('areas', 'offices');
  ALTER TABLE "_import_mappings_v" ALTER COLUMN "version_record_type" SET DATA TYPE "public"."enum__import_mappings_v_version_record_type" USING "version_record_type"::"public"."enum__import_mappings_v_version_record_type";
  DROP INDEX IF EXISTS "country_slug_1_idx";
  DROP INDEX IF EXISTS "version_country_version_slug_1_idx";
  DROP INDEX IF EXISTS "country_slug_2_idx";
  DROP INDEX IF EXISTS "version_country_version_slug_2_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_actors_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_terms_id_idx";
  CREATE UNIQUE INDEX "country_slug_idx" ON "areas" USING btree ("country_id","slug");
  CREATE INDEX "version_country_version_slug_idx" ON "_areas_v" USING btree ("version_country_id","version_slug");
  CREATE UNIQUE INDEX "country_slug_1_idx" ON "offices" USING btree ("country_id","slug");
  CREATE INDEX "version_country_version_slug_1_idx" ON "_offices_v" USING btree ("version_country_id","version_slug");
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "actors_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "terms_id";
  ALTER TABLE "site_locales" DROP COLUMN "strings_officials";
  ALTER TABLE "site_locales" DROP COLUMN "strings_see_all_officials";
  ALTER TABLE "site_locales" DROP COLUMN "strings_who_is_delivering";
  ALTER TABLE "site_locales" DROP COLUMN "strings_past_administrations";
  ALTER TABLE "site_locales" DROP COLUMN "strings_who_this_is";
  ALTER TABLE "site_locales" DROP COLUMN "strings_time_in_office";
  ALTER TABLE "site_locales" DROP COLUMN "strings_present";
  ALTER TABLE "site_locales" DROP COLUMN "strings_closing_summary";
  ALTER TABLE "site_locales" DROP COLUMN "strings_succeeded_by";
  ALTER TABLE "site_locales" DROP COLUMN "strings_former_holder";
  ALTER TABLE "site_locales" DROP COLUMN "strings_no_holder";
  ALTER TABLE "site_locales" DROP COLUMN "strings_links";
  ALTER TABLE "site_locales" DROP COLUMN "strings_photo_credit";
  ALTER TABLE "site_locales" DROP COLUMN "strings_filter_office";
  ALTER TABLE "site_locales" DROP COLUMN "strings_filter_area";
  ALTER TABLE "site_locales" DROP COLUMN "strings_filter_party";
  ALTER TABLE "site_locales" DROP COLUMN "strings_filter_all";
  ALTER TABLE "site_locales" DROP COLUMN "strings_sort_by";
  ALTER TABLE "site_locales" DROP COLUMN "strings_sort_name";
  ALTER TABLE "site_locales" DROP COLUMN "strings_sort_office";
  ALTER TABLE "site_locales" DROP COLUMN "strings_show_results";
  ALTER TABLE "site_locales" DROP COLUMN "strings_no_matches";
  ALTER TABLE "site_locales" DROP COLUMN "strings_next_page";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_officials";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_see_all_officials";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_who_is_delivering";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_past_administrations";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_who_this_is";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_time_in_office";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_present";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_closing_summary";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_succeeded_by";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_former_holder";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_no_holder";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_links";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_photo_credit";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_filter_office";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_filter_area";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_filter_party";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_filter_all";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_sort_by";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_sort_name";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_sort_office";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_show_results";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_no_matches";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_next_page";
  DROP TYPE "public"."enum_actors_links_type";
  DROP TYPE "public"."enum_actors_kind";
  DROP TYPE "public"."enum_actors_gender";
  DROP TYPE "public"."enum_actors_institution_type";
  DROP TYPE "public"."enum_actors_record_status";
  DROP TYPE "public"."enum__actors_v_version_links_type";
  DROP TYPE "public"."enum__actors_v_version_kind";
  DROP TYPE "public"."enum__actors_v_version_gender";
  DROP TYPE "public"."enum__actors_v_version_institution_type";
  DROP TYPE "public"."enum__actors_v_version_record_status";`)
}
