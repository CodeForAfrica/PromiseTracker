import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."_locales" AS ENUM('en', 'fr', 'pt', 'ar', 'sw');
  CREATE TYPE "public"."enum_countries_languages" AS ENUM('en', 'fr', 'pt', 'ar', 'sw');
  CREATE TYPE "public"."enum_countries_code" AS ENUM('dz', 'ao', 'bj', 'bw', 'bf', 'bi', 'cm', 'cv', 'cf', 'td', 'km', 'ci', 'cd', 'dj', 'eg', 'gq', 'er', 'sz', 'et', 'ga', 'gm', 'gh', 'gn', 'gw', 'ke', 'ls', 'lr', 'ly', 'mg', 'mw', 'ml', 'mr', 'mu', 'ma', 'mz', 'na', 'ne', 'ng', 'cg', 'rw', 'st', 'sn', 'sc', 'sl', 'so', 'za', 'ss', 'sd', 'tz', 'tg', 'tn', 'ug', 'zm', 'zw');
  CREATE TYPE "public"."enum_countries_region" AS ENUM('east-africa', 'west-africa', 'central-africa', 'southern-africa', 'north-africa');
  CREATE TYPE "public"."enum_countries_default_language" AS ENUM('en', 'fr', 'pt', 'ar', 'sw');
  CREATE TYPE "public"."enum_countries_record_status" AS ENUM('ready', 'hold', 'archived');
  CREATE TYPE "public"."enum__countries_v_version_languages" AS ENUM('en', 'fr', 'pt', 'ar', 'sw');
  CREATE TYPE "public"."enum__countries_v_version_code" AS ENUM('dz', 'ao', 'bj', 'bw', 'bf', 'bi', 'cm', 'cv', 'cf', 'td', 'km', 'ci', 'cd', 'dj', 'eg', 'gq', 'er', 'sz', 'et', 'ga', 'gm', 'gh', 'gn', 'gw', 'ke', 'ls', 'lr', 'ly', 'mg', 'mw', 'ml', 'mr', 'mu', 'ma', 'mz', 'na', 'ne', 'ng', 'cg', 'rw', 'st', 'sn', 'sc', 'sl', 'so', 'za', 'ss', 'sd', 'tz', 'tg', 'tn', 'ug', 'zm', 'zw');
  CREATE TYPE "public"."enum__countries_v_version_region" AS ENUM('east-africa', 'west-africa', 'central-africa', 'southern-africa', 'north-africa');
  CREATE TYPE "public"."enum__countries_v_version_default_language" AS ENUM('en', 'fr', 'pt', 'ar', 'sw');
  CREATE TYPE "public"."enum__countries_v_version_record_status" AS ENUM('ready', 'hold', 'archived');
  CREATE TABLE "countries_languages" (
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"value" "enum_countries_languages",
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL
  );
  
  CREATE TABLE "countries" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"code" "enum_countries_code" NOT NULL,
  	"region" "enum_countries_region",
  	"default_language" "enum_countries_default_language",
  	"record_status" "enum_countries_record_status" DEFAULT 'hold' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "countries_locales" (
  	"name" varchar,
  	"about" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" uuid NOT NULL
  );
  
  CREATE TABLE "countries_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "countries_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" uuid
  );
  
  CREATE TABLE "_countries_v_version_languages" (
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"value" "enum__countries_v_version_languages",
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL
  );
  
  CREATE TABLE "_countries_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"parent_id" uuid,
  	"version_code" "enum__countries_v_version_code" NOT NULL,
  	"version_region" "enum__countries_v_version_region",
  	"version_default_language" "enum__countries_v_version_default_language",
  	"version_record_status" "enum__countries_v_version_record_status" DEFAULT 'hold' NOT NULL,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_countries_v_locales" (
  	"version_name" varchar,
  	"version_about" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" uuid NOT NULL
  );
  
  CREATE TABLE "_countries_v_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "_countries_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" uuid
  );
  
  CREATE TABLE "site_navigation" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"url" varchar NOT NULL
  );
  
  CREATE TABLE "site_navigation_locales" (
  	"label" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "site_footer_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"url" varchar NOT NULL
  );
  
  CREATE TABLE "site_footer_links_locales" (
  	"label" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "site_locales" (
  	"description" varchar,
  	"explainer" varchar,
  	"footer_about" varchar,
  	"strings_skip_to_content" varchar,
  	"strings_home" varchar,
  	"strings_verified" varchar,
  	"strings_countries_nav" varchar,
  	"strings_other_countries" varchar,
  	"strings_menu" varchar,
  	"strings_close_menu" varchar,
  	"strings_language" varchar,
  	"strings_headline" varchar,
  	"strings_headline_tail" varchar,
  	"strings_lede" varchar,
  	"strings_about_site" varchar,
  	"strings_choose_country" varchar,
  	"strings_not_available_title" varchar,
  	"strings_not_available_body" varchar,
  	"strings_not_found_title" varchar,
  	"strings_not_found_body" varchar,
  	"strings_back_home" varchar,
  	"strings_footer_nav" varchar,
  	"strings_initiative" varchar,
  	"strings_copyright" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" uuid NOT NULL
  );
  
  CREATE TABLE "_site_v_version_navigation" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"url" varchar NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_site_v_version_navigation_locales" (
  	"label" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" uuid NOT NULL
  );
  
  CREATE TABLE "_site_v_version_footer_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"url" varchar NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_site_v_version_footer_links_locales" (
  	"label" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" uuid NOT NULL
  );
  
  CREATE TABLE "_site_v_locales" (
  	"version_description" varchar,
  	"version_explainer" varchar,
  	"version_footer_about" varchar,
  	"version_strings_skip_to_content" varchar,
  	"version_strings_home" varchar,
  	"version_strings_verified" varchar,
  	"version_strings_countries_nav" varchar,
  	"version_strings_other_countries" varchar,
  	"version_strings_menu" varchar,
  	"version_strings_close_menu" varchar,
  	"version_strings_language" varchar,
  	"version_strings_headline" varchar,
  	"version_strings_headline_tail" varchar,
  	"version_strings_lede" varchar,
  	"version_strings_about_site" varchar,
  	"version_strings_choose_country" varchar,
  	"version_strings_not_available_title" varchar,
  	"version_strings_not_available_body" varchar,
  	"version_strings_not_found_title" varchar,
  	"version_strings_not_found_body" varchar,
  	"version_strings_back_home" varchar,
  	"version_strings_footer_nav" varchar,
  	"version_strings_initiative" varchar,
  	"version_strings_copyright" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" uuid NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "countries_id" uuid;
  ALTER TABLE "countries_languages" ADD CONSTRAINT "countries_languages_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."countries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "countries_locales" ADD CONSTRAINT "countries_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."countries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "countries_texts" ADD CONSTRAINT "countries_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."countries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "countries_rels" ADD CONSTRAINT "countries_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."countries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "countries_rels" ADD CONSTRAINT "countries_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_countries_v_version_languages" ADD CONSTRAINT "_countries_v_version_languages_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_countries_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_countries_v" ADD CONSTRAINT "_countries_v_parent_id_countries_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."countries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_countries_v_locales" ADD CONSTRAINT "_countries_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_countries_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_countries_v_texts" ADD CONSTRAINT "_countries_v_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_countries_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_countries_v_rels" ADD CONSTRAINT "_countries_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_countries_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_countries_v_rels" ADD CONSTRAINT "_countries_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_navigation" ADD CONSTRAINT "site_navigation_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_navigation_locales" ADD CONSTRAINT "site_navigation_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_navigation"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_footer_links" ADD CONSTRAINT "site_footer_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_footer_links_locales" ADD CONSTRAINT "site_footer_links_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_footer_links"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_locales" ADD CONSTRAINT "site_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_site_v_version_navigation" ADD CONSTRAINT "_site_v_version_navigation_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_site_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_site_v_version_navigation_locales" ADD CONSTRAINT "_site_v_version_navigation_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_site_v_version_navigation"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_site_v_version_footer_links" ADD CONSTRAINT "_site_v_version_footer_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_site_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_site_v_version_footer_links_locales" ADD CONSTRAINT "_site_v_version_footer_links_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_site_v_version_footer_links"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_site_v_locales" ADD CONSTRAINT "_site_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_site_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "countries_languages_order_idx" ON "countries_languages" USING btree ("order");
  CREATE INDEX "countries_languages_parent_idx" ON "countries_languages" USING btree ("parent_id");
  CREATE UNIQUE INDEX "countries_code_idx" ON "countries" USING btree ("code");
  CREATE INDEX "countries_record_status_idx" ON "countries" USING btree ("record_status");
  CREATE INDEX "countries_updated_at_idx" ON "countries" USING btree ("updated_at");
  CREATE INDEX "countries_created_at_idx" ON "countries" USING btree ("created_at");
  CREATE UNIQUE INDEX "countries_locales_parent_id_locale_unique" ON "countries_locales" USING btree ("_parent_id","_locale");
  CREATE INDEX "countries_texts_order_parent" ON "countries_texts" USING btree ("order","parent_id");
  CREATE INDEX "countries_texts_text_idx" ON "countries_texts" USING btree ("text");
  CREATE INDEX "countries_rels_order_idx" ON "countries_rels" USING btree ("order");
  CREATE INDEX "countries_rels_parent_idx" ON "countries_rels" USING btree ("parent_id");
  CREATE INDEX "countries_rels_path_idx" ON "countries_rels" USING btree ("path");
  CREATE INDEX "countries_rels_users_id_idx" ON "countries_rels" USING btree ("users_id");
  CREATE INDEX "_countries_v_version_languages_order_idx" ON "_countries_v_version_languages" USING btree ("order");
  CREATE INDEX "_countries_v_version_languages_parent_idx" ON "_countries_v_version_languages" USING btree ("parent_id");
  CREATE INDEX "_countries_v_parent_idx" ON "_countries_v" USING btree ("parent_id");
  CREATE INDEX "_countries_v_version_version_code_idx" ON "_countries_v" USING btree ("version_code");
  CREATE INDEX "_countries_v_version_version_record_status_idx" ON "_countries_v" USING btree ("version_record_status");
  CREATE INDEX "_countries_v_version_version_updated_at_idx" ON "_countries_v" USING btree ("version_updated_at");
  CREATE INDEX "_countries_v_version_version_created_at_idx" ON "_countries_v" USING btree ("version_created_at");
  CREATE INDEX "_countries_v_created_at_idx" ON "_countries_v" USING btree ("created_at");
  CREATE INDEX "_countries_v_updated_at_idx" ON "_countries_v" USING btree ("updated_at");
  CREATE UNIQUE INDEX "_countries_v_locales_parent_id_locale_unique" ON "_countries_v_locales" USING btree ("_parent_id","_locale");
  CREATE INDEX "_countries_v_texts_order_parent" ON "_countries_v_texts" USING btree ("order","parent_id");
  CREATE INDEX "_countries_v_rels_order_idx" ON "_countries_v_rels" USING btree ("order");
  CREATE INDEX "_countries_v_rels_parent_idx" ON "_countries_v_rels" USING btree ("parent_id");
  CREATE INDEX "_countries_v_rels_path_idx" ON "_countries_v_rels" USING btree ("path");
  CREATE INDEX "_countries_v_rels_users_id_idx" ON "_countries_v_rels" USING btree ("users_id");
  CREATE INDEX "site_navigation_order_idx" ON "site_navigation" USING btree ("_order");
  CREATE INDEX "site_navigation_parent_id_idx" ON "site_navigation" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "site_navigation_locales_parent_id_locale_unique" ON "site_navigation_locales" USING btree ("_parent_id","_locale");
  CREATE INDEX "site_footer_links_order_idx" ON "site_footer_links" USING btree ("_order");
  CREATE INDEX "site_footer_links_parent_id_idx" ON "site_footer_links" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "site_footer_links_locales_parent_id_locale_unique" ON "site_footer_links_locales" USING btree ("_parent_id","_locale");
  CREATE UNIQUE INDEX "site_locales_parent_id_locale_unique" ON "site_locales" USING btree ("_parent_id","_locale");
  CREATE INDEX "_site_v_version_navigation_order_idx" ON "_site_v_version_navigation" USING btree ("_order");
  CREATE INDEX "_site_v_version_navigation_parent_id_idx" ON "_site_v_version_navigation" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_site_v_version_navigation_locales_parent_id_locale_unique" ON "_site_v_version_navigation_locales" USING btree ("_parent_id","_locale");
  CREATE INDEX "_site_v_version_footer_links_order_idx" ON "_site_v_version_footer_links" USING btree ("_order");
  CREATE INDEX "_site_v_version_footer_links_parent_id_idx" ON "_site_v_version_footer_links" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_site_v_version_footer_links_locales_parent_id_locale_unique" ON "_site_v_version_footer_links_locales" USING btree ("_parent_id","_locale");
  CREATE UNIQUE INDEX "_site_v_locales_parent_id_locale_unique" ON "_site_v_locales" USING btree ("_parent_id","_locale");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_countries_fk" FOREIGN KEY ("countries_id") REFERENCES "public"."countries"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_countries_id_idx" ON "payload_locked_documents_rels" USING btree ("countries_id");
  ALTER TABLE "site" DROP COLUMN "tagline";
  ALTER TABLE "_site_v" DROP COLUMN "version_tagline";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "countries_languages" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "countries" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "countries_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "countries_texts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "countries_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_countries_v_version_languages" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_countries_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_countries_v_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_countries_v_texts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_countries_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "site_navigation" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "site_navigation_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "site_footer_links" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "site_footer_links_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "site_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_site_v_version_navigation" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_site_v_version_navigation_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_site_v_version_footer_links" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_site_v_version_footer_links_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_site_v_locales" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "countries_languages" CASCADE;
  DROP TABLE "countries" CASCADE;
  DROP TABLE "countries_locales" CASCADE;
  DROP TABLE "countries_texts" CASCADE;
  DROP TABLE "countries_rels" CASCADE;
  DROP TABLE "_countries_v_version_languages" CASCADE;
  DROP TABLE "_countries_v" CASCADE;
  DROP TABLE "_countries_v_locales" CASCADE;
  DROP TABLE "_countries_v_texts" CASCADE;
  DROP TABLE "_countries_v_rels" CASCADE;
  DROP TABLE "site_navigation" CASCADE;
  DROP TABLE "site_navigation_locales" CASCADE;
  DROP TABLE "site_footer_links" CASCADE;
  DROP TABLE "site_footer_links_locales" CASCADE;
  DROP TABLE "site_locales" CASCADE;
  DROP TABLE "_site_v_version_navigation" CASCADE;
  DROP TABLE "_site_v_version_navigation_locales" CASCADE;
  DROP TABLE "_site_v_version_footer_links" CASCADE;
  DROP TABLE "_site_v_version_footer_links_locales" CASCADE;
  DROP TABLE "_site_v_locales" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_countries_fk";
  
  DROP INDEX IF EXISTS "payload_locked_documents_rels_countries_id_idx";
  ALTER TABLE "site" ADD COLUMN "tagline" varchar;
  ALTER TABLE "_site_v" ADD COLUMN "version_tagline" varchar;
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "countries_id";
  DROP TYPE "public"."_locales";
  DROP TYPE "public"."enum_countries_languages";
  DROP TYPE "public"."enum_countries_code";
  DROP TYPE "public"."enum_countries_region";
  DROP TYPE "public"."enum_countries_default_language";
  DROP TYPE "public"."enum_countries_record_status";
  DROP TYPE "public"."enum__countries_v_version_languages";
  DROP TYPE "public"."enum__countries_v_version_code";
  DROP TYPE "public"."enum__countries_v_version_region";
  DROP TYPE "public"."enum__countries_v_version_default_language";
  DROP TYPE "public"."enum__countries_v_version_record_status";`)
}
