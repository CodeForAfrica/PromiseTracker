import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // The interface text moves from a column per string to one value per
  // language (D109): Postgres reads at most a hundred columns in one call, and
  // the strings outnumber that. Each language's text is copied across before
  // the old columns go.
  await db.execute(sql`
  ALTER TABLE "site_locales" ADD COLUMN "strings" jsonb;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings" jsonb;`)
  await columnsToJson(db, 'site_locales', 'strings')
  await columnsToJson(db, '_site_v_locales', 'version_strings')
  await db.execute(sql`
   CREATE TYPE "public"."enum_themes_record_status" AS ENUM('ready', 'hold', 'archived');
  CREATE TYPE "public"."enum_themes_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__themes_v_version_record_status" AS ENUM('ready', 'hold', 'archived');
  CREATE TYPE "public"."enum__themes_v_published_locale" AS ENUM('en', 'fr', 'pt', 'ar', 'sw');
  CREATE TYPE "public"."enum__themes_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_articles_record_status" AS ENUM('ready', 'hold', 'archived');
  CREATE TYPE "public"."enum_articles_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__articles_v_version_record_status" AS ENUM('ready', 'hold', 'archived');
  CREATE TYPE "public"."enum__articles_v_published_locale" AS ENUM('en', 'fr', 'pt', 'ar', 'sw');
  CREATE TYPE "public"."enum__articles_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_pages_record_status" AS ENUM('ready', 'hold', 'archived');
  CREATE TYPE "public"."enum_pages_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__pages_v_version_record_status" AS ENUM('ready', 'hold', 'archived');
  CREATE TYPE "public"."enum__pages_v_published_locale" AS ENUM('en', 'fr', 'pt', 'ar', 'sw');
  CREATE TYPE "public"."enum__pages_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_site_sections_home_featured_claim" AS ENUM('auto', 'on', 'off');
  CREATE TYPE "public"."enum_site_sections_home_in_focus" AS ENUM('auto', 'on', 'off');
  CREATE TYPE "public"."enum_site_sections_home_how_ratings_work" AS ENUM('auto', 'on', 'off');
  CREATE TYPE "public"."enum_site_sections_home_tracked" AS ENUM('auto', 'on', 'off');
  CREATE TYPE "public"."enum_site_sections_home_choose_country" AS ENUM('auto', 'on', 'off');
  CREATE TYPE "public"."enum_site_sections_home_partners" AS ENUM('auto', 'on', 'off');
  CREATE TYPE "public"."enum_site_sections_home_sister_tools" AS ENUM('auto', 'on', 'off');
  CREATE TYPE "public"."enum_site_sections_country_in_focus" AS ENUM('auto', 'on', 'off');
  CREATE TYPE "public"."enum_site_sections_country_snapshot" AS ENUM('auto', 'on', 'off');
  CREATE TYPE "public"."enum_site_sections_country_who_is_delivering" AS ENUM('auto', 'on', 'off');
  CREATE TYPE "public"."enum_site_sections_country_officials" AS ENUM('auto', 'on', 'off');
  CREATE TYPE "public"."enum_site_sections_country_past_administrations" AS ENUM('auto', 'on', 'off');
  CREATE TYPE "public"."enum_site_sections_actor_latest_changes" AS ENUM('auto', 'on', 'off');
  CREATE TYPE "public"."enum_site_sections_actor_latest_analysis" AS ENUM('auto', 'on', 'off');
  CREATE TYPE "public"."enum_site_sections_actor_closing_summary" AS ENUM('auto', 'on', 'off');
  CREATE TYPE "public"."enum_site_sections_claim_latest_analysis" AS ENUM('auto', 'on', 'off');
  CREATE TYPE "public"."enum__site_v_version_sections_home_featured_claim" AS ENUM('auto', 'on', 'off');
  CREATE TYPE "public"."enum__site_v_version_sections_home_in_focus" AS ENUM('auto', 'on', 'off');
  CREATE TYPE "public"."enum__site_v_version_sections_home_how_ratings_work" AS ENUM('auto', 'on', 'off');
  CREATE TYPE "public"."enum__site_v_version_sections_home_tracked" AS ENUM('auto', 'on', 'off');
  CREATE TYPE "public"."enum__site_v_version_sections_home_choose_country" AS ENUM('auto', 'on', 'off');
  CREATE TYPE "public"."enum__site_v_version_sections_home_partners" AS ENUM('auto', 'on', 'off');
  CREATE TYPE "public"."enum__site_v_version_sections_home_sister_tools" AS ENUM('auto', 'on', 'off');
  CREATE TYPE "public"."enum__site_v_version_sections_country_in_focus" AS ENUM('auto', 'on', 'off');
  CREATE TYPE "public"."enum__site_v_version_sections_country_snapshot" AS ENUM('auto', 'on', 'off');
  CREATE TYPE "public"."enum__site_v_version_sections_country_who_is_delivering" AS ENUM('auto', 'on', 'off');
  CREATE TYPE "public"."enum__site_v_version_sections_country_officials" AS ENUM('auto', 'on', 'off');
  CREATE TYPE "public"."enum__site_v_version_sections_country_past_administrations" AS ENUM('auto', 'on', 'off');
  CREATE TYPE "public"."enum__site_v_version_sections_actor_latest_changes" AS ENUM('auto', 'on', 'off');
  CREATE TYPE "public"."enum__site_v_version_sections_actor_latest_analysis" AS ENUM('auto', 'on', 'off');
  CREATE TYPE "public"."enum__site_v_version_sections_actor_closing_summary" AS ENUM('auto', 'on', 'off');
  CREATE TYPE "public"."enum__site_v_version_sections_claim_latest_analysis" AS ENUM('auto', 'on', 'off');
  CREATE TABLE "themes" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"image_id" uuid,
  	"slug" varchar,
  	"record_status" "enum_themes_record_status" DEFAULT 'hold',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "themes_locales" (
  	"title" varchar,
  	"introduction" varchar,
  	"_status" "enum_themes_status" DEFAULT 'draft',
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" uuid NOT NULL
  );
  
  CREATE TABLE "themes_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "themes_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"claims_id" uuid,
  	"countries_id" uuid,
  	"users_id" uuid
  );
  
  CREATE TABLE "_themes_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"parent_id" uuid,
  	"version_image_id" uuid,
  	"version_slug" varchar,
  	"version_record_status" "enum__themes_v_version_record_status" DEFAULT 'hold',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version_deleted_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"published_locale" "enum__themes_v_published_locale",
  	"latest" boolean
  );
  
  CREATE TABLE "_themes_v_locales" (
  	"version_title" varchar,
  	"version_introduction" varchar,
  	"version__status" "enum__themes_v_version_status" DEFAULT 'draft',
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" uuid NOT NULL
  );
  
  CREATE TABLE "_themes_v_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "_themes_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"claims_id" uuid,
  	"countries_id" uuid,
  	"users_id" uuid
  );
  
  CREATE TABLE "articles" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"image_id" uuid,
  	"date" timestamp(3) with time zone,
  	"byline" varchar,
  	"hide_byline" boolean DEFAULT false,
  	"country_id" uuid,
  	"slug" varchar,
  	"record_status" "enum_articles_record_status" DEFAULT 'hold',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "articles_locales" (
  	"title" varchar,
  	"standfirst" varchar,
  	"body" jsonb,
  	"_status" "enum_articles_status" DEFAULT 'draft',
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" uuid NOT NULL
  );
  
  CREATE TABLE "articles_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "articles_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"claims_id" uuid,
  	"actors_id" uuid,
  	"countries_id" uuid,
  	"users_id" uuid
  );
  
  CREATE TABLE "_articles_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"parent_id" uuid,
  	"version_image_id" uuid,
  	"version_date" timestamp(3) with time zone,
  	"version_byline" varchar,
  	"version_hide_byline" boolean DEFAULT false,
  	"version_country_id" uuid,
  	"version_slug" varchar,
  	"version_record_status" "enum__articles_v_version_record_status" DEFAULT 'hold',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version_deleted_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"published_locale" "enum__articles_v_published_locale",
  	"latest" boolean
  );
  
  CREATE TABLE "_articles_v_locales" (
  	"version_title" varchar,
  	"version_standfirst" varchar,
  	"version_body" jsonb,
  	"version__status" "enum__articles_v_version_status" DEFAULT 'draft',
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" uuid NOT NULL
  );
  
  CREATE TABLE "_articles_v_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "_articles_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"claims_id" uuid,
  	"actors_id" uuid,
  	"countries_id" uuid,
  	"users_id" uuid
  );
  
  CREATE TABLE "pages" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"_order" varchar,
  	"link" varchar,
  	"parent_id" uuid,
  	"slug" varchar,
  	"path" varchar,
  	"record_status" "enum_pages_record_status" DEFAULT 'hold',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "pages_locales" (
  	"title" varchar,
  	"summary" varchar,
  	"body" jsonb,
  	"_status" "enum_pages_status" DEFAULT 'draft',
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" uuid NOT NULL
  );
  
  CREATE TABLE "pages_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "pages_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" uuid
  );
  
  CREATE TABLE "_pages_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"parent_id" uuid,
  	"version__order" varchar,
  	"version_link" varchar,
  	"version_parent_id" uuid,
  	"version_slug" varchar,
  	"version_path" varchar,
  	"version_record_status" "enum__pages_v_version_record_status" DEFAULT 'hold',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version_deleted_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"published_locale" "enum__pages_v_published_locale",
  	"latest" boolean
  );
  
  CREATE TABLE "_pages_v_locales" (
  	"version_title" varchar,
  	"version_summary" varchar,
  	"version_body" jsonb,
  	"version__status" "enum__pages_v_version_status" DEFAULT 'draft',
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" uuid NOT NULL
  );
  
  CREATE TABLE "_pages_v_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "_pages_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" uuid
  );
  
  CREATE TABLE "partners" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"_order" varchar,
  	"name" varchar NOT NULL,
  	"logo_id" uuid,
  	"url" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "partners_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"countries_id" uuid,
  	"users_id" uuid
  );
  
  CREATE TABLE "_partners_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"parent_id" uuid,
  	"version__order" varchar,
  	"version_name" varchar NOT NULL,
  	"version_logo_id" uuid,
  	"version_url" varchar NOT NULL,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version_deleted_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_partners_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"countries_id" uuid,
  	"users_id" uuid
  );
  
  CREATE TABLE "sister_tools" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"_order" varchar,
  	"name" varchar NOT NULL,
  	"url" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "sister_tools_locales" (
  	"description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" uuid NOT NULL
  );
  
  CREATE TABLE "sister_tools_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" uuid
  );
  
  CREATE TABLE "_sister_tools_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"parent_id" uuid,
  	"version__order" varchar,
  	"version_name" varchar NOT NULL,
  	"version_url" varchar NOT NULL,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version_deleted_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_sister_tools_v_locales" (
  	"version_description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" uuid NOT NULL
  );
  
  CREATE TABLE "_sister_tools_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" uuid
  );
  
  CREATE TABLE "site_country_picks" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"country_id" uuid
  );
  
  CREATE TABLE "_site_v_version_country_picks" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"country_id" uuid,
  	"_uuid" varchar
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "themes_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "articles_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "pages_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "partners_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "sister_tools_id" uuid;
  ALTER TABLE "site" ADD COLUMN "picks_featured_claim_id" uuid;
  ALTER TABLE "site" ADD COLUMN "picks_in_focus_id" uuid;
  ALTER TABLE "site" ADD COLUMN "picks_featured_area_id" uuid;
  ALTER TABLE "site" ADD COLUMN "sections_home_featured_claim" "enum_site_sections_home_featured_claim" DEFAULT 'auto';
  ALTER TABLE "site" ADD COLUMN "sections_home_in_focus" "enum_site_sections_home_in_focus" DEFAULT 'auto';
  ALTER TABLE "site" ADD COLUMN "sections_home_how_ratings_work" "enum_site_sections_home_how_ratings_work" DEFAULT 'auto';
  ALTER TABLE "site" ADD COLUMN "sections_home_tracked" "enum_site_sections_home_tracked" DEFAULT 'auto';
  ALTER TABLE "site" ADD COLUMN "sections_home_choose_country" "enum_site_sections_home_choose_country" DEFAULT 'auto';
  ALTER TABLE "site" ADD COLUMN "sections_home_partners" "enum_site_sections_home_partners" DEFAULT 'auto';
  ALTER TABLE "site" ADD COLUMN "sections_home_sister_tools" "enum_site_sections_home_sister_tools" DEFAULT 'auto';
  ALTER TABLE "site" ADD COLUMN "sections_country_in_focus" "enum_site_sections_country_in_focus" DEFAULT 'auto';
  ALTER TABLE "site" ADD COLUMN "sections_country_snapshot" "enum_site_sections_country_snapshot" DEFAULT 'auto';
  ALTER TABLE "site" ADD COLUMN "sections_country_who_is_delivering" "enum_site_sections_country_who_is_delivering" DEFAULT 'auto';
  ALTER TABLE "site" ADD COLUMN "sections_country_officials" "enum_site_sections_country_officials" DEFAULT 'auto';
  ALTER TABLE "site" ADD COLUMN "sections_country_past_administrations" "enum_site_sections_country_past_administrations" DEFAULT 'auto';
  ALTER TABLE "site" ADD COLUMN "sections_actor_latest_changes" "enum_site_sections_actor_latest_changes" DEFAULT 'auto';
  ALTER TABLE "site" ADD COLUMN "sections_actor_latest_analysis" "enum_site_sections_actor_latest_analysis" DEFAULT 'auto';
  ALTER TABLE "site" ADD COLUMN "sections_actor_closing_summary" "enum_site_sections_actor_closing_summary" DEFAULT 'auto';
  ALTER TABLE "site" ADD COLUMN "sections_claim_latest_analysis" "enum_site_sections_claim_latest_analysis" DEFAULT 'auto';
  ALTER TABLE "site_rels" ADD COLUMN "actors_id" uuid;
  ALTER TABLE "site_rels" ADD COLUMN "claims_id" uuid;
  ALTER TABLE "_site_v" ADD COLUMN "version_picks_featured_claim_id" uuid;
  ALTER TABLE "_site_v" ADD COLUMN "version_picks_in_focus_id" uuid;
  ALTER TABLE "_site_v" ADD COLUMN "version_picks_featured_area_id" uuid;
  ALTER TABLE "_site_v" ADD COLUMN "version_sections_home_featured_claim" "enum__site_v_version_sections_home_featured_claim" DEFAULT 'auto';
  ALTER TABLE "_site_v" ADD COLUMN "version_sections_home_in_focus" "enum__site_v_version_sections_home_in_focus" DEFAULT 'auto';
  ALTER TABLE "_site_v" ADD COLUMN "version_sections_home_how_ratings_work" "enum__site_v_version_sections_home_how_ratings_work" DEFAULT 'auto';
  ALTER TABLE "_site_v" ADD COLUMN "version_sections_home_tracked" "enum__site_v_version_sections_home_tracked" DEFAULT 'auto';
  ALTER TABLE "_site_v" ADD COLUMN "version_sections_home_choose_country" "enum__site_v_version_sections_home_choose_country" DEFAULT 'auto';
  ALTER TABLE "_site_v" ADD COLUMN "version_sections_home_partners" "enum__site_v_version_sections_home_partners" DEFAULT 'auto';
  ALTER TABLE "_site_v" ADD COLUMN "version_sections_home_sister_tools" "enum__site_v_version_sections_home_sister_tools" DEFAULT 'auto';
  ALTER TABLE "_site_v" ADD COLUMN "version_sections_country_in_focus" "enum__site_v_version_sections_country_in_focus" DEFAULT 'auto';
  ALTER TABLE "_site_v" ADD COLUMN "version_sections_country_snapshot" "enum__site_v_version_sections_country_snapshot" DEFAULT 'auto';
  ALTER TABLE "_site_v" ADD COLUMN "version_sections_country_who_is_delivering" "enum__site_v_version_sections_country_who_is_delivering" DEFAULT 'auto';
  ALTER TABLE "_site_v" ADD COLUMN "version_sections_country_officials" "enum__site_v_version_sections_country_officials" DEFAULT 'auto';
  ALTER TABLE "_site_v" ADD COLUMN "version_sections_country_past_administrations" "enum__site_v_version_sections_country_past_administrations" DEFAULT 'auto';
  ALTER TABLE "_site_v" ADD COLUMN "version_sections_actor_latest_changes" "enum__site_v_version_sections_actor_latest_changes" DEFAULT 'auto';
  ALTER TABLE "_site_v" ADD COLUMN "version_sections_actor_latest_analysis" "enum__site_v_version_sections_actor_latest_analysis" DEFAULT 'auto';
  ALTER TABLE "_site_v" ADD COLUMN "version_sections_actor_closing_summary" "enum__site_v_version_sections_actor_closing_summary" DEFAULT 'auto';
  ALTER TABLE "_site_v" ADD COLUMN "version_sections_claim_latest_analysis" "enum__site_v_version_sections_claim_latest_analysis" DEFAULT 'auto';
  ALTER TABLE "_site_v_rels" ADD COLUMN "actors_id" uuid;
  ALTER TABLE "_site_v_rels" ADD COLUMN "claims_id" uuid;
  ALTER TABLE "themes" ADD CONSTRAINT "themes_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "themes_locales" ADD CONSTRAINT "themes_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."themes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "themes_texts" ADD CONSTRAINT "themes_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."themes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "themes_rels" ADD CONSTRAINT "themes_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."themes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "themes_rels" ADD CONSTRAINT "themes_rels_claims_fk" FOREIGN KEY ("claims_id") REFERENCES "public"."claims"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "themes_rels" ADD CONSTRAINT "themes_rels_countries_fk" FOREIGN KEY ("countries_id") REFERENCES "public"."countries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "themes_rels" ADD CONSTRAINT "themes_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_themes_v" ADD CONSTRAINT "_themes_v_parent_id_themes_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."themes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_themes_v" ADD CONSTRAINT "_themes_v_version_image_id_media_id_fk" FOREIGN KEY ("version_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_themes_v_locales" ADD CONSTRAINT "_themes_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_themes_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_themes_v_texts" ADD CONSTRAINT "_themes_v_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_themes_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_themes_v_rels" ADD CONSTRAINT "_themes_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_themes_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_themes_v_rels" ADD CONSTRAINT "_themes_v_rels_claims_fk" FOREIGN KEY ("claims_id") REFERENCES "public"."claims"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_themes_v_rels" ADD CONSTRAINT "_themes_v_rels_countries_fk" FOREIGN KEY ("countries_id") REFERENCES "public"."countries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_themes_v_rels" ADD CONSTRAINT "_themes_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles" ADD CONSTRAINT "articles_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "articles" ADD CONSTRAINT "articles_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "articles_locales" ADD CONSTRAINT "articles_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles_texts" ADD CONSTRAINT "articles_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles_rels" ADD CONSTRAINT "articles_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles_rels" ADD CONSTRAINT "articles_rels_claims_fk" FOREIGN KEY ("claims_id") REFERENCES "public"."claims"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles_rels" ADD CONSTRAINT "articles_rels_actors_fk" FOREIGN KEY ("actors_id") REFERENCES "public"."actors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles_rels" ADD CONSTRAINT "articles_rels_countries_fk" FOREIGN KEY ("countries_id") REFERENCES "public"."countries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles_rels" ADD CONSTRAINT "articles_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v" ADD CONSTRAINT "_articles_v_parent_id_articles_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_articles_v" ADD CONSTRAINT "_articles_v_version_image_id_media_id_fk" FOREIGN KEY ("version_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_articles_v" ADD CONSTRAINT "_articles_v_version_country_id_countries_id_fk" FOREIGN KEY ("version_country_id") REFERENCES "public"."countries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_articles_v_locales" ADD CONSTRAINT "_articles_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_articles_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_texts" ADD CONSTRAINT "_articles_v_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_articles_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_rels" ADD CONSTRAINT "_articles_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_articles_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_rels" ADD CONSTRAINT "_articles_v_rels_claims_fk" FOREIGN KEY ("claims_id") REFERENCES "public"."claims"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_rels" ADD CONSTRAINT "_articles_v_rels_actors_fk" FOREIGN KEY ("actors_id") REFERENCES "public"."actors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_rels" ADD CONSTRAINT "_articles_v_rels_countries_fk" FOREIGN KEY ("countries_id") REFERENCES "public"."countries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_rels" ADD CONSTRAINT "_articles_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages" ADD CONSTRAINT "pages_parent_id_pages_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_locales" ADD CONSTRAINT "pages_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_texts" ADD CONSTRAINT "pages_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_rels" ADD CONSTRAINT "pages_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_rels" ADD CONSTRAINT "pages_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_parent_id_pages_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_version_parent_id_pages_id_fk" FOREIGN KEY ("version_parent_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_locales" ADD CONSTRAINT "_pages_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_texts" ADD CONSTRAINT "_pages_v_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_rels" ADD CONSTRAINT "_pages_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_rels" ADD CONSTRAINT "_pages_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "partners" ADD CONSTRAINT "partners_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "partners_rels" ADD CONSTRAINT "partners_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "partners_rels" ADD CONSTRAINT "partners_rels_countries_fk" FOREIGN KEY ("countries_id") REFERENCES "public"."countries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "partners_rels" ADD CONSTRAINT "partners_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_partners_v" ADD CONSTRAINT "_partners_v_parent_id_partners_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_partners_v" ADD CONSTRAINT "_partners_v_version_logo_id_media_id_fk" FOREIGN KEY ("version_logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_partners_v_rels" ADD CONSTRAINT "_partners_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_partners_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_partners_v_rels" ADD CONSTRAINT "_partners_v_rels_countries_fk" FOREIGN KEY ("countries_id") REFERENCES "public"."countries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_partners_v_rels" ADD CONSTRAINT "_partners_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "sister_tools_locales" ADD CONSTRAINT "sister_tools_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."sister_tools"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "sister_tools_rels" ADD CONSTRAINT "sister_tools_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."sister_tools"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "sister_tools_rels" ADD CONSTRAINT "sister_tools_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_sister_tools_v" ADD CONSTRAINT "_sister_tools_v_parent_id_sister_tools_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."sister_tools"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_sister_tools_v_locales" ADD CONSTRAINT "_sister_tools_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_sister_tools_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_sister_tools_v_rels" ADD CONSTRAINT "_sister_tools_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_sister_tools_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_sister_tools_v_rels" ADD CONSTRAINT "_sister_tools_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_country_picks" ADD CONSTRAINT "site_country_picks_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "site_country_picks" ADD CONSTRAINT "site_country_picks_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_site_v_version_country_picks" ADD CONSTRAINT "_site_v_version_country_picks_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_site_v_version_country_picks" ADD CONSTRAINT "_site_v_version_country_picks_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_site_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "themes_image_idx" ON "themes" USING btree ("image_id");
  CREATE INDEX "themes_slug_idx" ON "themes" USING btree ("slug");
  CREATE INDEX "themes_record_status_idx" ON "themes" USING btree ("record_status");
  CREATE INDEX "themes_updated_at_idx" ON "themes" USING btree ("updated_at");
  CREATE INDEX "themes_created_at_idx" ON "themes" USING btree ("created_at");
  CREATE INDEX "themes_deleted_at_idx" ON "themes" USING btree ("deleted_at");
  CREATE INDEX "themes__status_idx" ON "themes_locales" USING btree ("_status","_locale");
  CREATE UNIQUE INDEX "themes_locales_parent_id_locale_unique" ON "themes_locales" USING btree ("_parent_id","_locale");
  CREATE INDEX "themes_texts_order_parent" ON "themes_texts" USING btree ("order","parent_id");
  CREATE INDEX "themes_texts_text_idx" ON "themes_texts" USING btree ("text");
  CREATE INDEX "themes_rels_order_idx" ON "themes_rels" USING btree ("order");
  CREATE INDEX "themes_rels_parent_idx" ON "themes_rels" USING btree ("parent_id");
  CREATE INDEX "themes_rels_path_idx" ON "themes_rels" USING btree ("path");
  CREATE INDEX "themes_rels_claims_id_idx" ON "themes_rels" USING btree ("claims_id");
  CREATE INDEX "themes_rels_countries_id_idx" ON "themes_rels" USING btree ("countries_id");
  CREATE INDEX "themes_rels_users_id_idx" ON "themes_rels" USING btree ("users_id");
  CREATE INDEX "_themes_v_parent_idx" ON "_themes_v" USING btree ("parent_id");
  CREATE INDEX "_themes_v_version_version_image_idx" ON "_themes_v" USING btree ("version_image_id");
  CREATE INDEX "_themes_v_version_version_slug_idx" ON "_themes_v" USING btree ("version_slug");
  CREATE INDEX "_themes_v_version_version_record_status_idx" ON "_themes_v" USING btree ("version_record_status");
  CREATE INDEX "_themes_v_version_version_updated_at_idx" ON "_themes_v" USING btree ("version_updated_at");
  CREATE INDEX "_themes_v_version_version_created_at_idx" ON "_themes_v" USING btree ("version_created_at");
  CREATE INDEX "_themes_v_version_version_deleted_at_idx" ON "_themes_v" USING btree ("version_deleted_at");
  CREATE INDEX "_themes_v_created_at_idx" ON "_themes_v" USING btree ("created_at");
  CREATE INDEX "_themes_v_updated_at_idx" ON "_themes_v" USING btree ("updated_at");
  CREATE INDEX "_themes_v_published_locale_idx" ON "_themes_v" USING btree ("published_locale");
  CREATE INDEX "_themes_v_latest_idx" ON "_themes_v" USING btree ("latest");
  CREATE INDEX "_themes_v_version_version__status_idx" ON "_themes_v_locales" USING btree ("version__status","_locale");
  CREATE UNIQUE INDEX "_themes_v_locales_parent_id_locale_unique" ON "_themes_v_locales" USING btree ("_parent_id","_locale");
  CREATE INDEX "_themes_v_texts_order_parent" ON "_themes_v_texts" USING btree ("order","parent_id");
  CREATE INDEX "_themes_v_rels_order_idx" ON "_themes_v_rels" USING btree ("order");
  CREATE INDEX "_themes_v_rels_parent_idx" ON "_themes_v_rels" USING btree ("parent_id");
  CREATE INDEX "_themes_v_rels_path_idx" ON "_themes_v_rels" USING btree ("path");
  CREATE INDEX "_themes_v_rels_claims_id_idx" ON "_themes_v_rels" USING btree ("claims_id");
  CREATE INDEX "_themes_v_rels_countries_id_idx" ON "_themes_v_rels" USING btree ("countries_id");
  CREATE INDEX "_themes_v_rels_users_id_idx" ON "_themes_v_rels" USING btree ("users_id");
  CREATE INDEX "articles_image_idx" ON "articles" USING btree ("image_id");
  CREATE INDEX "articles_date_idx" ON "articles" USING btree ("date");
  CREATE INDEX "articles_country_idx" ON "articles" USING btree ("country_id");
  CREATE INDEX "articles_slug_idx" ON "articles" USING btree ("slug");
  CREATE INDEX "articles_record_status_idx" ON "articles" USING btree ("record_status");
  CREATE INDEX "articles_updated_at_idx" ON "articles" USING btree ("updated_at");
  CREATE INDEX "articles_created_at_idx" ON "articles" USING btree ("created_at");
  CREATE INDEX "articles_deleted_at_idx" ON "articles" USING btree ("deleted_at");
  CREATE UNIQUE INDEX "country_slug_4_idx" ON "articles" USING btree ("country_id","slug");
  CREATE INDEX "country_date_idx" ON "articles" USING btree ("country_id","date");
  CREATE INDEX "articles__status_idx" ON "articles_locales" USING btree ("_status","_locale");
  CREATE UNIQUE INDEX "articles_locales_parent_id_locale_unique" ON "articles_locales" USING btree ("_parent_id","_locale");
  CREATE INDEX "articles_texts_order_parent" ON "articles_texts" USING btree ("order","parent_id");
  CREATE INDEX "articles_texts_text_idx" ON "articles_texts" USING btree ("text");
  CREATE INDEX "articles_rels_order_idx" ON "articles_rels" USING btree ("order");
  CREATE INDEX "articles_rels_parent_idx" ON "articles_rels" USING btree ("parent_id");
  CREATE INDEX "articles_rels_path_idx" ON "articles_rels" USING btree ("path");
  CREATE INDEX "articles_rels_claims_id_idx" ON "articles_rels" USING btree ("claims_id");
  CREATE INDEX "articles_rels_actors_id_idx" ON "articles_rels" USING btree ("actors_id");
  CREATE INDEX "articles_rels_countries_id_idx" ON "articles_rels" USING btree ("countries_id");
  CREATE INDEX "articles_rels_users_id_idx" ON "articles_rels" USING btree ("users_id");
  CREATE INDEX "_articles_v_parent_idx" ON "_articles_v" USING btree ("parent_id");
  CREATE INDEX "_articles_v_version_version_image_idx" ON "_articles_v" USING btree ("version_image_id");
  CREATE INDEX "_articles_v_version_version_date_idx" ON "_articles_v" USING btree ("version_date");
  CREATE INDEX "_articles_v_version_version_country_idx" ON "_articles_v" USING btree ("version_country_id");
  CREATE INDEX "_articles_v_version_version_slug_idx" ON "_articles_v" USING btree ("version_slug");
  CREATE INDEX "_articles_v_version_version_record_status_idx" ON "_articles_v" USING btree ("version_record_status");
  CREATE INDEX "_articles_v_version_version_updated_at_idx" ON "_articles_v" USING btree ("version_updated_at");
  CREATE INDEX "_articles_v_version_version_created_at_idx" ON "_articles_v" USING btree ("version_created_at");
  CREATE INDEX "_articles_v_version_version_deleted_at_idx" ON "_articles_v" USING btree ("version_deleted_at");
  CREATE INDEX "_articles_v_created_at_idx" ON "_articles_v" USING btree ("created_at");
  CREATE INDEX "_articles_v_updated_at_idx" ON "_articles_v" USING btree ("updated_at");
  CREATE INDEX "_articles_v_published_locale_idx" ON "_articles_v" USING btree ("published_locale");
  CREATE INDEX "_articles_v_latest_idx" ON "_articles_v" USING btree ("latest");
  CREATE INDEX "version_country_version_slug_4_idx" ON "_articles_v" USING btree ("version_country_id","version_slug");
  CREATE INDEX "version_country_version_date_idx" ON "_articles_v" USING btree ("version_country_id","version_date");
  CREATE INDEX "_articles_v_version_version__status_idx" ON "_articles_v_locales" USING btree ("version__status","_locale");
  CREATE UNIQUE INDEX "_articles_v_locales_parent_id_locale_unique" ON "_articles_v_locales" USING btree ("_parent_id","_locale");
  CREATE INDEX "_articles_v_texts_order_parent" ON "_articles_v_texts" USING btree ("order","parent_id");
  CREATE INDEX "_articles_v_rels_order_idx" ON "_articles_v_rels" USING btree ("order");
  CREATE INDEX "_articles_v_rels_parent_idx" ON "_articles_v_rels" USING btree ("parent_id");
  CREATE INDEX "_articles_v_rels_path_idx" ON "_articles_v_rels" USING btree ("path");
  CREATE INDEX "_articles_v_rels_claims_id_idx" ON "_articles_v_rels" USING btree ("claims_id");
  CREATE INDEX "_articles_v_rels_actors_id_idx" ON "_articles_v_rels" USING btree ("actors_id");
  CREATE INDEX "_articles_v_rels_countries_id_idx" ON "_articles_v_rels" USING btree ("countries_id");
  CREATE INDEX "_articles_v_rels_users_id_idx" ON "_articles_v_rels" USING btree ("users_id");
  CREATE INDEX "pages__order_idx" ON "pages" USING btree ("_order");
  CREATE INDEX "pages_parent_idx" ON "pages" USING btree ("parent_id");
  CREATE INDEX "pages_slug_idx" ON "pages" USING btree ("slug");
  CREATE UNIQUE INDEX "pages_path_idx" ON "pages" USING btree ("path");
  CREATE INDEX "pages_record_status_idx" ON "pages" USING btree ("record_status");
  CREATE INDEX "pages_updated_at_idx" ON "pages" USING btree ("updated_at");
  CREATE INDEX "pages_created_at_idx" ON "pages" USING btree ("created_at");
  CREATE INDEX "pages_deleted_at_idx" ON "pages" USING btree ("deleted_at");
  CREATE INDEX "pages__status_idx" ON "pages_locales" USING btree ("_status","_locale");
  CREATE UNIQUE INDEX "pages_locales_parent_id_locale_unique" ON "pages_locales" USING btree ("_parent_id","_locale");
  CREATE INDEX "pages_texts_order_parent" ON "pages_texts" USING btree ("order","parent_id");
  CREATE INDEX "pages_texts_text_idx" ON "pages_texts" USING btree ("text");
  CREATE INDEX "pages_rels_order_idx" ON "pages_rels" USING btree ("order");
  CREATE INDEX "pages_rels_parent_idx" ON "pages_rels" USING btree ("parent_id");
  CREATE INDEX "pages_rels_path_idx" ON "pages_rels" USING btree ("path");
  CREATE INDEX "pages_rels_users_id_idx" ON "pages_rels" USING btree ("users_id");
  CREATE INDEX "_pages_v_parent_idx" ON "_pages_v" USING btree ("parent_id");
  CREATE INDEX "_pages_v_version_version__order_idx" ON "_pages_v" USING btree ("version__order");
  CREATE INDEX "_pages_v_version_version_parent_idx" ON "_pages_v" USING btree ("version_parent_id");
  CREATE INDEX "_pages_v_version_version_slug_idx" ON "_pages_v" USING btree ("version_slug");
  CREATE INDEX "_pages_v_version_version_path_idx" ON "_pages_v" USING btree ("version_path");
  CREATE INDEX "_pages_v_version_version_record_status_idx" ON "_pages_v" USING btree ("version_record_status");
  CREATE INDEX "_pages_v_version_version_updated_at_idx" ON "_pages_v" USING btree ("version_updated_at");
  CREATE INDEX "_pages_v_version_version_created_at_idx" ON "_pages_v" USING btree ("version_created_at");
  CREATE INDEX "_pages_v_version_version_deleted_at_idx" ON "_pages_v" USING btree ("version_deleted_at");
  CREATE INDEX "_pages_v_created_at_idx" ON "_pages_v" USING btree ("created_at");
  CREATE INDEX "_pages_v_updated_at_idx" ON "_pages_v" USING btree ("updated_at");
  CREATE INDEX "_pages_v_published_locale_idx" ON "_pages_v" USING btree ("published_locale");
  CREATE INDEX "_pages_v_latest_idx" ON "_pages_v" USING btree ("latest");
  CREATE INDEX "_pages_v_version_version__status_idx" ON "_pages_v_locales" USING btree ("version__status","_locale");
  CREATE UNIQUE INDEX "_pages_v_locales_parent_id_locale_unique" ON "_pages_v_locales" USING btree ("_parent_id","_locale");
  CREATE INDEX "_pages_v_texts_order_parent" ON "_pages_v_texts" USING btree ("order","parent_id");
  CREATE INDEX "_pages_v_rels_order_idx" ON "_pages_v_rels" USING btree ("order");
  CREATE INDEX "_pages_v_rels_parent_idx" ON "_pages_v_rels" USING btree ("parent_id");
  CREATE INDEX "_pages_v_rels_path_idx" ON "_pages_v_rels" USING btree ("path");
  CREATE INDEX "_pages_v_rels_users_id_idx" ON "_pages_v_rels" USING btree ("users_id");
  CREATE INDEX "partners__order_idx" ON "partners" USING btree ("_order");
  CREATE INDEX "partners_logo_idx" ON "partners" USING btree ("logo_id");
  CREATE INDEX "partners_updated_at_idx" ON "partners" USING btree ("updated_at");
  CREATE INDEX "partners_created_at_idx" ON "partners" USING btree ("created_at");
  CREATE INDEX "partners_deleted_at_idx" ON "partners" USING btree ("deleted_at");
  CREATE INDEX "partners_rels_order_idx" ON "partners_rels" USING btree ("order");
  CREATE INDEX "partners_rels_parent_idx" ON "partners_rels" USING btree ("parent_id");
  CREATE INDEX "partners_rels_path_idx" ON "partners_rels" USING btree ("path");
  CREATE INDEX "partners_rels_countries_id_idx" ON "partners_rels" USING btree ("countries_id");
  CREATE INDEX "partners_rels_users_id_idx" ON "partners_rels" USING btree ("users_id");
  CREATE INDEX "_partners_v_parent_idx" ON "_partners_v" USING btree ("parent_id");
  CREATE INDEX "_partners_v_version_version__order_idx" ON "_partners_v" USING btree ("version__order");
  CREATE INDEX "_partners_v_version_version_logo_idx" ON "_partners_v" USING btree ("version_logo_id");
  CREATE INDEX "_partners_v_version_version_updated_at_idx" ON "_partners_v" USING btree ("version_updated_at");
  CREATE INDEX "_partners_v_version_version_created_at_idx" ON "_partners_v" USING btree ("version_created_at");
  CREATE INDEX "_partners_v_version_version_deleted_at_idx" ON "_partners_v" USING btree ("version_deleted_at");
  CREATE INDEX "_partners_v_created_at_idx" ON "_partners_v" USING btree ("created_at");
  CREATE INDEX "_partners_v_updated_at_idx" ON "_partners_v" USING btree ("updated_at");
  CREATE INDEX "_partners_v_rels_order_idx" ON "_partners_v_rels" USING btree ("order");
  CREATE INDEX "_partners_v_rels_parent_idx" ON "_partners_v_rels" USING btree ("parent_id");
  CREATE INDEX "_partners_v_rels_path_idx" ON "_partners_v_rels" USING btree ("path");
  CREATE INDEX "_partners_v_rels_countries_id_idx" ON "_partners_v_rels" USING btree ("countries_id");
  CREATE INDEX "_partners_v_rels_users_id_idx" ON "_partners_v_rels" USING btree ("users_id");
  CREATE INDEX "sister_tools__order_idx" ON "sister_tools" USING btree ("_order");
  CREATE INDEX "sister_tools_updated_at_idx" ON "sister_tools" USING btree ("updated_at");
  CREATE INDEX "sister_tools_created_at_idx" ON "sister_tools" USING btree ("created_at");
  CREATE INDEX "sister_tools_deleted_at_idx" ON "sister_tools" USING btree ("deleted_at");
  CREATE UNIQUE INDEX "sister_tools_locales_parent_id_locale_unique" ON "sister_tools_locales" USING btree ("_parent_id","_locale");
  CREATE INDEX "sister_tools_rels_order_idx" ON "sister_tools_rels" USING btree ("order");
  CREATE INDEX "sister_tools_rels_parent_idx" ON "sister_tools_rels" USING btree ("parent_id");
  CREATE INDEX "sister_tools_rels_path_idx" ON "sister_tools_rels" USING btree ("path");
  CREATE INDEX "sister_tools_rels_users_id_idx" ON "sister_tools_rels" USING btree ("users_id");
  CREATE INDEX "_sister_tools_v_parent_idx" ON "_sister_tools_v" USING btree ("parent_id");
  CREATE INDEX "_sister_tools_v_version_version__order_idx" ON "_sister_tools_v" USING btree ("version__order");
  CREATE INDEX "_sister_tools_v_version_version_updated_at_idx" ON "_sister_tools_v" USING btree ("version_updated_at");
  CREATE INDEX "_sister_tools_v_version_version_created_at_idx" ON "_sister_tools_v" USING btree ("version_created_at");
  CREATE INDEX "_sister_tools_v_version_version_deleted_at_idx" ON "_sister_tools_v" USING btree ("version_deleted_at");
  CREATE INDEX "_sister_tools_v_created_at_idx" ON "_sister_tools_v" USING btree ("created_at");
  CREATE INDEX "_sister_tools_v_updated_at_idx" ON "_sister_tools_v" USING btree ("updated_at");
  CREATE UNIQUE INDEX "_sister_tools_v_locales_parent_id_locale_unique" ON "_sister_tools_v_locales" USING btree ("_parent_id","_locale");
  CREATE INDEX "_sister_tools_v_rels_order_idx" ON "_sister_tools_v_rels" USING btree ("order");
  CREATE INDEX "_sister_tools_v_rels_parent_idx" ON "_sister_tools_v_rels" USING btree ("parent_id");
  CREATE INDEX "_sister_tools_v_rels_path_idx" ON "_sister_tools_v_rels" USING btree ("path");
  CREATE INDEX "_sister_tools_v_rels_users_id_idx" ON "_sister_tools_v_rels" USING btree ("users_id");
  CREATE INDEX "site_country_picks_order_idx" ON "site_country_picks" USING btree ("_order");
  CREATE INDEX "site_country_picks_parent_id_idx" ON "site_country_picks" USING btree ("_parent_id");
  CREATE INDEX "site_country_picks_country_idx" ON "site_country_picks" USING btree ("country_id");
  CREATE INDEX "_site_v_version_country_picks_order_idx" ON "_site_v_version_country_picks" USING btree ("_order");
  CREATE INDEX "_site_v_version_country_picks_parent_id_idx" ON "_site_v_version_country_picks" USING btree ("_parent_id");
  CREATE INDEX "_site_v_version_country_picks_country_idx" ON "_site_v_version_country_picks" USING btree ("country_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_themes_fk" FOREIGN KEY ("themes_id") REFERENCES "public"."themes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_articles_fk" FOREIGN KEY ("articles_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_partners_fk" FOREIGN KEY ("partners_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_sister_tools_fk" FOREIGN KEY ("sister_tools_id") REFERENCES "public"."sister_tools"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site" ADD CONSTRAINT "site_picks_featured_claim_id_claims_id_fk" FOREIGN KEY ("picks_featured_claim_id") REFERENCES "public"."claims"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "site" ADD CONSTRAINT "site_picks_in_focus_id_themes_id_fk" FOREIGN KEY ("picks_in_focus_id") REFERENCES "public"."themes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "site" ADD CONSTRAINT "site_picks_featured_area_id_areas_id_fk" FOREIGN KEY ("picks_featured_area_id") REFERENCES "public"."areas"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "site_rels" ADD CONSTRAINT "site_rels_actors_fk" FOREIGN KEY ("actors_id") REFERENCES "public"."actors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_rels" ADD CONSTRAINT "site_rels_claims_fk" FOREIGN KEY ("claims_id") REFERENCES "public"."claims"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_site_v" ADD CONSTRAINT "_site_v_version_picks_featured_claim_id_claims_id_fk" FOREIGN KEY ("version_picks_featured_claim_id") REFERENCES "public"."claims"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_site_v" ADD CONSTRAINT "_site_v_version_picks_in_focus_id_themes_id_fk" FOREIGN KEY ("version_picks_in_focus_id") REFERENCES "public"."themes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_site_v" ADD CONSTRAINT "_site_v_version_picks_featured_area_id_areas_id_fk" FOREIGN KEY ("version_picks_featured_area_id") REFERENCES "public"."areas"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_site_v_rels" ADD CONSTRAINT "_site_v_rels_actors_fk" FOREIGN KEY ("actors_id") REFERENCES "public"."actors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_site_v_rels" ADD CONSTRAINT "_site_v_rels_claims_fk" FOREIGN KEY ("claims_id") REFERENCES "public"."claims"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_themes_id_idx" ON "payload_locked_documents_rels" USING btree ("themes_id");
  CREATE INDEX "payload_locked_documents_rels_articles_id_idx" ON "payload_locked_documents_rels" USING btree ("articles_id");
  CREATE INDEX "payload_locked_documents_rels_pages_id_idx" ON "payload_locked_documents_rels" USING btree ("pages_id");
  CREATE INDEX "payload_locked_documents_rels_partners_id_idx" ON "payload_locked_documents_rels" USING btree ("partners_id");
  CREATE INDEX "payload_locked_documents_rels_sister_tools_id_idx" ON "payload_locked_documents_rels" USING btree ("sister_tools_id");
  CREATE INDEX "site_picks_picks_featured_claim_idx" ON "site" USING btree ("picks_featured_claim_id");
  CREATE INDEX "site_picks_picks_in_focus_idx" ON "site" USING btree ("picks_in_focus_id");
  CREATE INDEX "site_picks_picks_featured_area_idx" ON "site" USING btree ("picks_featured_area_id");
  CREATE INDEX "site_rels_actors_id_idx" ON "site_rels" USING btree ("actors_id");
  CREATE INDEX "site_rels_claims_id_idx" ON "site_rels" USING btree ("claims_id");
  CREATE INDEX "_site_v_version_picks_version_picks_featured_claim_idx" ON "_site_v" USING btree ("version_picks_featured_claim_id");
  CREATE INDEX "_site_v_version_picks_version_picks_in_focus_idx" ON "_site_v" USING btree ("version_picks_in_focus_id");
  CREATE INDEX "_site_v_version_picks_version_picks_featured_area_idx" ON "_site_v" USING btree ("version_picks_featured_area_id");
  CREATE INDEX "_site_v_rels_actors_id_idx" ON "_site_v_rels" USING btree ("actors_id");
  CREATE INDEX "_site_v_rels_claims_id_idx" ON "_site_v_rels" USING btree ("claims_id");
  ALTER TABLE "site_locales" DROP COLUMN "strings_skip_to_content";
  ALTER TABLE "site_locales" DROP COLUMN "strings_home";
  ALTER TABLE "site_locales" DROP COLUMN "strings_verified";
  ALTER TABLE "site_locales" DROP COLUMN "strings_countries_nav";
  ALTER TABLE "site_locales" DROP COLUMN "strings_other_countries";
  ALTER TABLE "site_locales" DROP COLUMN "strings_menu";
  ALTER TABLE "site_locales" DROP COLUMN "strings_close_menu";
  ALTER TABLE "site_locales" DROP COLUMN "strings_language";
  ALTER TABLE "site_locales" DROP COLUMN "strings_headline";
  ALTER TABLE "site_locales" DROP COLUMN "strings_headline_tail";
  ALTER TABLE "site_locales" DROP COLUMN "strings_lede";
  ALTER TABLE "site_locales" DROP COLUMN "strings_about_site";
  ALTER TABLE "site_locales" DROP COLUMN "strings_choose_country";
  ALTER TABLE "site_locales" DROP COLUMN "strings_not_available_title";
  ALTER TABLE "site_locales" DROP COLUMN "strings_answers_for";
  ALTER TABLE "site_locales" DROP COLUMN "strings_seats_in_area";
  ALTER TABLE "site_locales" DROP COLUMN "strings_breadcrumb";
  ALTER TABLE "site_locales" DROP COLUMN "strings_not_available_body";
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
  ALTER TABLE "site_locales" DROP COLUMN "strings_verified_on";
  ALTER TABLE "site_locales" DROP COLUMN "strings_verified_title";
  ALTER TABLE "site_locales" DROP COLUMN "strings_verified_report";
  ALTER TABLE "site_locales" DROP COLUMN "strings_last_reviewed";
  ALTER TABLE "site_locales" DROP COLUMN "strings_timeline_title";
  ALTER TABLE "site_locales" DROP COLUMN "strings_history_title";
  ALTER TABLE "site_locales" DROP COLUMN "strings_full_history";
  ALTER TABLE "site_locales" DROP COLUMN "strings_back_to_claim";
  ALTER TABLE "site_locales" DROP COLUMN "strings_correction";
  ALTER TABLE "site_locales" DROP COLUMN "strings_evidence_title";
  ALTER TABLE "site_locales" DROP COLUMN "strings_latest_changes";
  ALTER TABLE "site_locales" DROP COLUMN "strings_reported_by";
  ALTER TABLE "site_locales" DROP COLUMN "strings_copy_citation";
  ALTER TABLE "site_locales" DROP COLUMN "strings_citation_copied";
  ALTER TABLE "site_locales" DROP COLUMN "strings_cite_as";
  ALTER TABLE "site_locales" DROP COLUMN "strings_cite_as_unreviewed";
  ALTER TABLE "site_locales" DROP COLUMN "strings_not_found_title";
  ALTER TABLE "site_locales" DROP COLUMN "strings_not_found_body";
  ALTER TABLE "site_locales" DROP COLUMN "strings_back_home";
  ALTER TABLE "site_locales" DROP COLUMN "strings_footer_nav";
  ALTER TABLE "site_locales" DROP COLUMN "strings_initiative";
  ALTER TABLE "site_locales" DROP COLUMN "strings_copyright";
  ALTER TABLE "site_locales" DROP COLUMN "strings_search";
  ALTER TABLE "site_locales" DROP COLUMN "strings_search_label";
  ALTER TABLE "site_locales" DROP COLUMN "strings_search_placeholder";
  ALTER TABLE "site_locales" DROP COLUMN "strings_search_title";
  ALTER TABLE "site_locales" DROP COLUMN "strings_search_intro";
  ALTER TABLE "site_locales" DROP COLUMN "strings_search_results";
  ALTER TABLE "site_locales" DROP COLUMN "strings_search_found";
  ALTER TABLE "site_locales" DROP COLUMN "strings_search_nothing";
  ALTER TABLE "site_locales" DROP COLUMN "strings_who_represents";
  ALTER TABLE "site_locales" DROP COLUMN "strings_open_place";
  ALTER TABLE "site_locales" DROP COLUMN "strings_search_people";
  ALTER TABLE "site_locales" DROP COLUMN "strings_search_claims";
  ALTER TABLE "site_locales" DROP COLUMN "strings_search_topics";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_skip_to_content";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_home";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_verified";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_countries_nav";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_other_countries";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_menu";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_close_menu";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_language";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_headline";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_headline_tail";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_lede";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_about_site";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_choose_country";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_not_available_title";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_answers_for";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_seats_in_area";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_breadcrumb";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_not_available_body";
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
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_verified_on";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_verified_title";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_verified_report";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_last_reviewed";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_timeline_title";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_history_title";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_full_history";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_back_to_claim";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_correction";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_evidence_title";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_latest_changes";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_reported_by";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_copy_citation";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_citation_copied";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_cite_as";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_cite_as_unreviewed";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_not_found_title";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_not_found_body";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_back_home";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_footer_nav";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_initiative";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_copyright";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_search";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_search_label";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_search_placeholder";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_search_title";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_search_intro";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_search_results";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_search_found";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_search_nothing";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_who_represents";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_open_place";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_search_people";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_search_claims";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_search_topics";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "themes" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "themes_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "themes_texts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "themes_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_themes_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_themes_v_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_themes_v_texts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_themes_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "articles" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "articles_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "articles_texts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "articles_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_articles_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_articles_v_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_articles_v_texts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_articles_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_texts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_texts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "partners" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "partners_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_partners_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_partners_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "sister_tools" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "sister_tools_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "sister_tools_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_sister_tools_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_sister_tools_v_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_sister_tools_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "site_country_picks" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_site_v_version_country_picks" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "themes" CASCADE;
  DROP TABLE "themes_locales" CASCADE;
  DROP TABLE "themes_texts" CASCADE;
  DROP TABLE "themes_rels" CASCADE;
  DROP TABLE "_themes_v" CASCADE;
  DROP TABLE "_themes_v_locales" CASCADE;
  DROP TABLE "_themes_v_texts" CASCADE;
  DROP TABLE "_themes_v_rels" CASCADE;
  DROP TABLE "articles" CASCADE;
  DROP TABLE "articles_locales" CASCADE;
  DROP TABLE "articles_texts" CASCADE;
  DROP TABLE "articles_rels" CASCADE;
  DROP TABLE "_articles_v" CASCADE;
  DROP TABLE "_articles_v_locales" CASCADE;
  DROP TABLE "_articles_v_texts" CASCADE;
  DROP TABLE "_articles_v_rels" CASCADE;
  DROP TABLE "pages" CASCADE;
  DROP TABLE "pages_locales" CASCADE;
  DROP TABLE "pages_texts" CASCADE;
  DROP TABLE "pages_rels" CASCADE;
  DROP TABLE "_pages_v" CASCADE;
  DROP TABLE "_pages_v_locales" CASCADE;
  DROP TABLE "_pages_v_texts" CASCADE;
  DROP TABLE "_pages_v_rels" CASCADE;
  DROP TABLE "partners" CASCADE;
  DROP TABLE "partners_rels" CASCADE;
  DROP TABLE "_partners_v" CASCADE;
  DROP TABLE "_partners_v_rels" CASCADE;
  DROP TABLE "sister_tools" CASCADE;
  DROP TABLE "sister_tools_locales" CASCADE;
  DROP TABLE "sister_tools_rels" CASCADE;
  DROP TABLE "_sister_tools_v" CASCADE;
  DROP TABLE "_sister_tools_v_locales" CASCADE;
  DROP TABLE "_sister_tools_v_rels" CASCADE;
  DROP TABLE "site_country_picks" CASCADE;
  DROP TABLE "_site_v_version_country_picks" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_themes_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_articles_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_pages_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_partners_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_sister_tools_fk";
  
  ALTER TABLE "site" DROP CONSTRAINT IF EXISTS "site_picks_featured_claim_id_claims_id_fk";
  
  ALTER TABLE "site" DROP CONSTRAINT IF EXISTS "site_picks_in_focus_id_themes_id_fk";
  
  ALTER TABLE "site" DROP CONSTRAINT IF EXISTS "site_picks_featured_area_id_areas_id_fk";
  
  ALTER TABLE "site_rels" DROP CONSTRAINT IF EXISTS "site_rels_actors_fk";
  
  ALTER TABLE "site_rels" DROP CONSTRAINT IF EXISTS "site_rels_claims_fk";
  
  ALTER TABLE "_site_v" DROP CONSTRAINT IF EXISTS "_site_v_version_picks_featured_claim_id_claims_id_fk";
  
  ALTER TABLE "_site_v" DROP CONSTRAINT IF EXISTS "_site_v_version_picks_in_focus_id_themes_id_fk";
  
  ALTER TABLE "_site_v" DROP CONSTRAINT IF EXISTS "_site_v_version_picks_featured_area_id_areas_id_fk";
  
  ALTER TABLE "_site_v_rels" DROP CONSTRAINT IF EXISTS "_site_v_rels_actors_fk";
  
  ALTER TABLE "_site_v_rels" DROP CONSTRAINT IF EXISTS "_site_v_rels_claims_fk";
  
  DROP INDEX "payload_locked_documents_rels_themes_id_idx";
  DROP INDEX "payload_locked_documents_rels_articles_id_idx";
  DROP INDEX "payload_locked_documents_rels_pages_id_idx";
  DROP INDEX "payload_locked_documents_rels_partners_id_idx";
  DROP INDEX "payload_locked_documents_rels_sister_tools_id_idx";
  DROP INDEX "site_picks_picks_featured_claim_idx";
  DROP INDEX "site_picks_picks_in_focus_idx";
  DROP INDEX "site_picks_picks_featured_area_idx";
  DROP INDEX "site_rels_actors_id_idx";
  DROP INDEX "site_rels_claims_id_idx";
  DROP INDEX "_site_v_version_picks_version_picks_featured_claim_idx";
  DROP INDEX "_site_v_version_picks_version_picks_in_focus_idx";
  DROP INDEX "_site_v_version_picks_version_picks_featured_area_idx";
  DROP INDEX "_site_v_rels_actors_id_idx";
  DROP INDEX "_site_v_rels_claims_id_idx";
  ALTER TABLE "site_locales" ADD COLUMN "strings_skip_to_content" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_home" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_verified" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_countries_nav" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_other_countries" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_menu" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_close_menu" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_language" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_headline" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_headline_tail" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_lede" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_about_site" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_choose_country" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_not_available_title" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_answers_for" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_seats_in_area" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_breadcrumb" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_not_available_body" varchar;
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
  ALTER TABLE "site_locales" ADD COLUMN "strings_verified_on" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_verified_title" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_verified_report" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_last_reviewed" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_timeline_title" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_history_title" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_full_history" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_back_to_claim" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_correction" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_evidence_title" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_latest_changes" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_reported_by" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_copy_citation" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_citation_copied" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_cite_as" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_cite_as_unreviewed" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_not_found_title" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_not_found_body" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_back_home" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_footer_nav" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_initiative" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_copyright" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_search" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_search_label" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_search_placeholder" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_search_title" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_search_intro" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_search_results" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_search_found" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_search_nothing" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_who_represents" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_open_place" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_search_people" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_search_claims" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_search_topics" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_skip_to_content" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_home" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_verified" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_countries_nav" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_other_countries" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_menu" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_close_menu" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_language" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_headline" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_headline_tail" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_lede" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_about_site" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_choose_country" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_not_available_title" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_answers_for" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_seats_in_area" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_breadcrumb" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_not_available_body" varchar;
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
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_verified_on" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_verified_title" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_verified_report" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_last_reviewed" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_timeline_title" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_history_title" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_full_history" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_back_to_claim" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_correction" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_evidence_title" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_latest_changes" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_reported_by" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_copy_citation" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_citation_copied" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_cite_as" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_cite_as_unreviewed" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_not_found_title" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_not_found_body" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_back_home" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_footer_nav" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_initiative" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_copyright" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_search" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_search_label" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_search_placeholder" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_search_title" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_search_intro" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_search_results" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_search_found" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_search_nothing" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_who_represents" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_open_place" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_search_people" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_search_claims" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_search_topics" varchar;
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "themes_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "articles_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "pages_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "partners_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "sister_tools_id";
  ALTER TABLE "site" DROP COLUMN "picks_featured_claim_id";
  ALTER TABLE "site" DROP COLUMN "picks_in_focus_id";
  ALTER TABLE "site" DROP COLUMN "picks_featured_area_id";
  ALTER TABLE "site" DROP COLUMN "sections_home_featured_claim";
  ALTER TABLE "site" DROP COLUMN "sections_home_in_focus";
  ALTER TABLE "site" DROP COLUMN "sections_home_how_ratings_work";
  ALTER TABLE "site" DROP COLUMN "sections_home_tracked";
  ALTER TABLE "site" DROP COLUMN "sections_home_choose_country";
  ALTER TABLE "site" DROP COLUMN "sections_home_partners";
  ALTER TABLE "site" DROP COLUMN "sections_home_sister_tools";
  ALTER TABLE "site" DROP COLUMN "sections_country_in_focus";
  ALTER TABLE "site" DROP COLUMN "sections_country_snapshot";
  ALTER TABLE "site" DROP COLUMN "sections_country_who_is_delivering";
  ALTER TABLE "site" DROP COLUMN "sections_country_officials";
  ALTER TABLE "site" DROP COLUMN "sections_country_past_administrations";
  ALTER TABLE "site" DROP COLUMN "sections_actor_latest_changes";
  ALTER TABLE "site" DROP COLUMN "sections_actor_latest_analysis";
  ALTER TABLE "site" DROP COLUMN "sections_actor_closing_summary";
  ALTER TABLE "site" DROP COLUMN "sections_claim_latest_analysis";
  ALTER TABLE "site_rels" DROP COLUMN "actors_id";
  ALTER TABLE "site_rels" DROP COLUMN "claims_id";
  ALTER TABLE "_site_v" DROP COLUMN "version_picks_featured_claim_id";
  ALTER TABLE "_site_v" DROP COLUMN "version_picks_in_focus_id";
  ALTER TABLE "_site_v" DROP COLUMN "version_picks_featured_area_id";
  ALTER TABLE "_site_v" DROP COLUMN "version_sections_home_featured_claim";
  ALTER TABLE "_site_v" DROP COLUMN "version_sections_home_in_focus";
  ALTER TABLE "_site_v" DROP COLUMN "version_sections_home_how_ratings_work";
  ALTER TABLE "_site_v" DROP COLUMN "version_sections_home_tracked";
  ALTER TABLE "_site_v" DROP COLUMN "version_sections_home_choose_country";
  ALTER TABLE "_site_v" DROP COLUMN "version_sections_home_partners";
  ALTER TABLE "_site_v" DROP COLUMN "version_sections_home_sister_tools";
  ALTER TABLE "_site_v" DROP COLUMN "version_sections_country_in_focus";
  ALTER TABLE "_site_v" DROP COLUMN "version_sections_country_snapshot";
  ALTER TABLE "_site_v" DROP COLUMN "version_sections_country_who_is_delivering";
  ALTER TABLE "_site_v" DROP COLUMN "version_sections_country_officials";
  ALTER TABLE "_site_v" DROP COLUMN "version_sections_country_past_administrations";
  ALTER TABLE "_site_v" DROP COLUMN "version_sections_actor_latest_changes";
  ALTER TABLE "_site_v" DROP COLUMN "version_sections_actor_latest_analysis";
  ALTER TABLE "_site_v" DROP COLUMN "version_sections_actor_closing_summary";
  ALTER TABLE "_site_v" DROP COLUMN "version_sections_claim_latest_analysis";
  ALTER TABLE "_site_v_rels" DROP COLUMN "actors_id";
  ALTER TABLE "_site_v_rels" DROP COLUMN "claims_id";
  DROP TYPE "public"."enum_themes_record_status";
  DROP TYPE "public"."enum_themes_status";
  DROP TYPE "public"."enum__themes_v_version_record_status";
  DROP TYPE "public"."enum__themes_v_published_locale";
  DROP TYPE "public"."enum__themes_v_version_status";
  DROP TYPE "public"."enum_articles_record_status";
  DROP TYPE "public"."enum_articles_status";
  DROP TYPE "public"."enum__articles_v_version_record_status";
  DROP TYPE "public"."enum__articles_v_published_locale";
  DROP TYPE "public"."enum__articles_v_version_status";
  DROP TYPE "public"."enum_pages_record_status";
  DROP TYPE "public"."enum_pages_status";
  DROP TYPE "public"."enum__pages_v_version_record_status";
  DROP TYPE "public"."enum__pages_v_published_locale";
  DROP TYPE "public"."enum__pages_v_version_status";
  DROP TYPE "public"."enum_site_sections_home_featured_claim";
  DROP TYPE "public"."enum_site_sections_home_in_focus";
  DROP TYPE "public"."enum_site_sections_home_how_ratings_work";
  DROP TYPE "public"."enum_site_sections_home_tracked";
  DROP TYPE "public"."enum_site_sections_home_choose_country";
  DROP TYPE "public"."enum_site_sections_home_partners";
  DROP TYPE "public"."enum_site_sections_home_sister_tools";
  DROP TYPE "public"."enum_site_sections_country_in_focus";
  DROP TYPE "public"."enum_site_sections_country_snapshot";
  DROP TYPE "public"."enum_site_sections_country_who_is_delivering";
  DROP TYPE "public"."enum_site_sections_country_officials";
  DROP TYPE "public"."enum_site_sections_country_past_administrations";
  DROP TYPE "public"."enum_site_sections_actor_latest_changes";
  DROP TYPE "public"."enum_site_sections_actor_latest_analysis";
  DROP TYPE "public"."enum_site_sections_actor_closing_summary";
  DROP TYPE "public"."enum_site_sections_claim_latest_analysis";
  DROP TYPE "public"."enum__site_v_version_sections_home_featured_claim";
  DROP TYPE "public"."enum__site_v_version_sections_home_in_focus";
  DROP TYPE "public"."enum__site_v_version_sections_home_how_ratings_work";
  DROP TYPE "public"."enum__site_v_version_sections_home_tracked";
  DROP TYPE "public"."enum__site_v_version_sections_home_choose_country";
  DROP TYPE "public"."enum__site_v_version_sections_home_partners";
  DROP TYPE "public"."enum__site_v_version_sections_home_sister_tools";
  DROP TYPE "public"."enum__site_v_version_sections_country_in_focus";
  DROP TYPE "public"."enum__site_v_version_sections_country_snapshot";
  DROP TYPE "public"."enum__site_v_version_sections_country_who_is_delivering";
  DROP TYPE "public"."enum__site_v_version_sections_country_officials";
  DROP TYPE "public"."enum__site_v_version_sections_country_past_administrations";
  DROP TYPE "public"."enum__site_v_version_sections_actor_latest_changes";
  DROP TYPE "public"."enum__site_v_version_sections_actor_latest_analysis";
  DROP TYPE "public"."enum__site_v_version_sections_actor_closing_summary";
  DROP TYPE "public"."enum__site_v_version_sections_claim_latest_analysis";`)
  await jsonToColumns(db, 'site_locales', 'strings')
  await jsonToColumns(db, '_site_v_locales', 'version_strings')
  await db.execute(sql`
  ALTER TABLE "site_locales" DROP COLUMN "strings";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings";`)
}

type Db = MigrateUpArgs['db']

/** `strings_skip_to_content` is the key `skipToContent`. */
const keyOf = (column: string, prefix: string): string =>
  column.slice(prefix.length + 1).replace(/_([a-z0-9])/g, (_match, c: string) => c.toUpperCase())

/** `skipToContent` is the column `strings_skip_to_content`. */
const columnOf = (key: string, prefix: string): string =>
  `${prefix}_${key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)}`

/** Copies each row's string columns into its one JSON value. Empty strings are left out. */
async function columnsToJson(db: Db, table: string, prefix: string): Promise<void> {
  const { rows } = await db.execute(sql`SELECT * FROM ${sql.identifier(table)}`)
  for (const row of rows as Record<string, unknown>[]) {
    const text: Record<string, string> = {}
    for (const [column, value] of Object.entries(row)) {
      if (column.startsWith(`${prefix}_`) && typeof value === 'string' && value.trim()) {
        text[keyOf(column, prefix)] = value
      }
    }
    if (Object.keys(text).length === 0) continue
    await db.execute(
      sql`UPDATE ${sql.identifier(table)} SET ${sql.identifier(prefix)} = ${JSON.stringify(text)}::jsonb WHERE "id" = ${row.id}`,
    )
  }
}

/** Copies each row's JSON value back into the string columns that exist again. */
async function jsonToColumns(db: Db, table: string, prefix: string): Promise<void> {
  const { rows: columns } = await db.execute(
    sql`SELECT column_name FROM information_schema.columns WHERE table_name = ${table}`,
  )
  const known = new Set((columns as { column_name: string }[]).map((c) => c.column_name))
  const { rows } = await db.execute(
    sql`SELECT "id", ${sql.identifier(prefix)} AS "text" FROM ${sql.identifier(table)}`,
  )
  for (const row of rows as { id: unknown; text: unknown }[]) {
    if (!row.text || typeof row.text !== 'object') continue
    for (const [key, value] of Object.entries(row.text as Record<string, unknown>)) {
      const column = columnOf(key, prefix)
      // Strings added since have no column to go back to.
      if (typeof value !== 'string' || !known.has(column)) continue
      await db.execute(
        sql`UPDATE ${sql.identifier(table)} SET ${sql.identifier(column)} = ${value} WHERE "id" = ${row.id}`,
      )
    }
  }
}
