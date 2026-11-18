import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_areas_type" AS ENUM('country', 'region', 'county', 'constituency', 'ward', 'city', 'other');
  CREATE TYPE "public"."enum_areas_page" AS ENUM('automatic', 'always', 'never');
  CREATE TYPE "public"."enum__areas_v_version_type" AS ENUM('country', 'region', 'county', 'constituency', 'ward', 'city', 'other');
  CREATE TYPE "public"."enum__areas_v_version_page" AS ENUM('automatic', 'always', 'never');
  CREATE TYPE "public"."enum_offices_area_type" AS ENUM('country', 'region', 'county', 'constituency', 'ward', 'city', 'other');
  CREATE TYPE "public"."enum__offices_v_version_area_type" AS ENUM('country', 'region', 'county', 'constituency', 'ward', 'city', 'other');
  CREATE TYPE "public"."enum_imports_mapping_field" AS ENUM('name', 'name:fr', 'name:pt', 'name:ar', 'name:sw', 'slug', 'type', 'parent', 'page', 'externalCode', 'shortName', 'shortName:fr', 'shortName:pt', 'shortName:ar', 'shortName:sw', 'areaType', 'holdersPerSeat', 'order');
  CREATE TYPE "public"."enum_imports_record_type" AS ENUM('areas', 'offices');
  CREATE TYPE "public"."enum_imports_next_step" AS ENUM('preview', 'import');
  CREATE TYPE "public"."enum_imports_status" AS ENUM('mapping', 'previewed', 'queued', 'running', 'done', 'failed');
  CREATE TYPE "public"."enum__imports_v_version_mapping_field" AS ENUM('name', 'name:fr', 'name:pt', 'name:ar', 'name:sw', 'slug', 'type', 'parent', 'page', 'externalCode', 'shortName', 'shortName:fr', 'shortName:pt', 'shortName:ar', 'shortName:sw', 'areaType', 'holdersPerSeat', 'order');
  CREATE TYPE "public"."enum__imports_v_version_record_type" AS ENUM('areas', 'offices');
  CREATE TYPE "public"."enum__imports_v_version_next_step" AS ENUM('preview', 'import');
  CREATE TYPE "public"."enum__imports_v_version_status" AS ENUM('mapping', 'previewed', 'queued', 'running', 'done', 'failed');
  CREATE TYPE "public"."enum_import_mappings_record_type" AS ENUM('areas', 'offices');
  CREATE TYPE "public"."enum__import_mappings_v_version_record_type" AS ENUM('areas', 'offices');
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'runImport');
  CREATE TYPE "public"."enum_payload_jobs_log_state" AS ENUM('failed', 'succeeded');
  CREATE TYPE "public"."enum_payload_jobs_log_parent_task_slug" AS ENUM('inline', 'runImport');
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'runImport');
  CREATE TABLE "areas" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"slug" varchar,
  	"type" "enum_areas_type" NOT NULL,
  	"parent_id" uuid,
  	"page" "enum_areas_page" DEFAULT 'automatic' NOT NULL,
  	"country_id" uuid NOT NULL,
  	"external_code" varchar,
  	"geo_latitude" numeric,
  	"geo_longitude" numeric,
  	"geo_bounds" jsonb,
  	"geo_outline_id" uuid,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "areas_locales" (
  	"name" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" uuid NOT NULL
  );
  
  CREATE TABLE "areas_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "areas_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" uuid
  );
  
  CREATE TABLE "_areas_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"parent_id" uuid,
  	"version_slug" varchar,
  	"version_type" "enum__areas_v_version_type" NOT NULL,
  	"version_parent_id" uuid,
  	"version_page" "enum__areas_v_version_page" DEFAULT 'automatic' NOT NULL,
  	"version_country_id" uuid NOT NULL,
  	"version_external_code" varchar,
  	"version_geo_latitude" numeric,
  	"version_geo_longitude" numeric,
  	"version_geo_bounds" jsonb,
  	"version_geo_outline_id" uuid,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_areas_v_locales" (
  	"version_name" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" uuid NOT NULL
  );
  
  CREATE TABLE "_areas_v_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "_areas_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" uuid
  );
  
  CREATE TABLE "offices" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"slug" varchar,
  	"area_type" "enum_offices_area_type",
  	"holders_per_seat" numeric DEFAULT 1 NOT NULL,
  	"order" numeric DEFAULT 0 NOT NULL,
  	"country_id" uuid NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "offices_locales" (
  	"name" varchar NOT NULL,
  	"short_name" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" uuid NOT NULL
  );
  
  CREATE TABLE "offices_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" uuid
  );
  
  CREATE TABLE "_offices_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"parent_id" uuid,
  	"version_slug" varchar,
  	"version_area_type" "enum__offices_v_version_area_type",
  	"version_holders_per_seat" numeric DEFAULT 1 NOT NULL,
  	"version_order" numeric DEFAULT 0 NOT NULL,
  	"version_country_id" uuid NOT NULL,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_offices_v_locales" (
  	"version_name" varchar NOT NULL,
  	"version_short_name" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" uuid NOT NULL
  );
  
  CREATE TABLE "_offices_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" uuid
  );
  
  CREATE TABLE "boundaries" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"source" varchar NOT NULL,
  	"licence" varchar NOT NULL,
  	"prefix" varchar DEFAULT '',
  	"_objectkey" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"_stored" boolean,
  	"_transforms" jsonb,
  	"original_filename" varchar,
  	"original_url" varchar,
  	"original_mime_type" varchar,
  	"original_filesize" numeric,
  	"original_width" numeric,
  	"original_height" numeric,
  	"original_prefix" varchar,
  	"original__objectkey" varchar,
  	"original__stored" boolean,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "boundaries_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" uuid
  );
  
  CREATE TABLE "_boundaries_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"parent_id" uuid,
  	"version_source" varchar NOT NULL,
  	"version_licence" varchar NOT NULL,
  	"version_prefix" varchar DEFAULT '',
  	"version__objectkey" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version_url" varchar,
  	"version_thumbnail_u_r_l" varchar,
  	"version_filename" varchar,
  	"version_mime_type" varchar,
  	"version_filesize" numeric,
  	"version_width" numeric,
  	"version_height" numeric,
  	"version__stored" boolean,
  	"version__transforms" jsonb,
  	"version_original_filename" varchar,
  	"version_original_url" varchar,
  	"version_original_mime_type" varchar,
  	"version_original_filesize" numeric,
  	"version_original_width" numeric,
  	"version_original_height" numeric,
  	"version_original_prefix" varchar,
  	"version_original__objectkey" varchar,
  	"version_original__stored" boolean,
  	"version_focal_x" numeric,
  	"version_focal_y" numeric,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_boundaries_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" uuid
  );
  
  CREATE TABLE "imports_mapping" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"field" "enum_imports_mapping_field",
  	"column" varchar
  );
  
  CREATE TABLE "imports" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"country_id" uuid NOT NULL,
  	"record_type" "enum_imports_record_type" NOT NULL,
  	"next_step" "enum_imports_next_step",
  	"save_mapping_as" varchar,
  	"status" "enum_imports_status" DEFAULT 'mapping',
  	"preview_create" numeric,
  	"preview_update" numeric,
  	"preview_skip" numeric,
  	"preview_failed" numeric,
  	"result_create" numeric,
  	"result_update" numeric,
  	"result_skip" numeric,
  	"result_failed" numeric,
  	"errors" jsonb,
  	"headings" jsonb,
  	"sample_rows" jsonb,
  	"rows" jsonb,
  	"prefix" varchar DEFAULT '',
  	"_objectkey" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"_stored" boolean,
  	"_transforms" jsonb,
  	"original_filename" varchar,
  	"original_url" varchar,
  	"original_mime_type" varchar,
  	"original_filesize" numeric,
  	"original_width" numeric,
  	"original_height" numeric,
  	"original_prefix" varchar,
  	"original__objectkey" varchar,
  	"original__stored" boolean,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "imports_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" uuid
  );
  
  CREATE TABLE "_imports_v_version_mapping" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"field" "enum__imports_v_version_mapping_field",
  	"column" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_imports_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"parent_id" uuid,
  	"version_country_id" uuid NOT NULL,
  	"version_record_type" "enum__imports_v_version_record_type" NOT NULL,
  	"version_next_step" "enum__imports_v_version_next_step",
  	"version_save_mapping_as" varchar,
  	"version_status" "enum__imports_v_version_status" DEFAULT 'mapping',
  	"version_preview_create" numeric,
  	"version_preview_update" numeric,
  	"version_preview_skip" numeric,
  	"version_preview_failed" numeric,
  	"version_result_create" numeric,
  	"version_result_update" numeric,
  	"version_result_skip" numeric,
  	"version_result_failed" numeric,
  	"version_errors" jsonb,
  	"version_headings" jsonb,
  	"version_sample_rows" jsonb,
  	"version_rows" jsonb,
  	"version_prefix" varchar DEFAULT '',
  	"version__objectkey" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version_url" varchar,
  	"version_thumbnail_u_r_l" varchar,
  	"version_filename" varchar,
  	"version_mime_type" varchar,
  	"version_filesize" numeric,
  	"version_width" numeric,
  	"version_height" numeric,
  	"version__stored" boolean,
  	"version__transforms" jsonb,
  	"version_original_filename" varchar,
  	"version_original_url" varchar,
  	"version_original_mime_type" varchar,
  	"version_original_filesize" numeric,
  	"version_original_width" numeric,
  	"version_original_height" numeric,
  	"version_original_prefix" varchar,
  	"version_original__objectkey" varchar,
  	"version_original__stored" boolean,
  	"version_focal_x" numeric,
  	"version_focal_y" numeric,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_imports_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" uuid
  );
  
  CREATE TABLE "import_mappings" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"name" varchar NOT NULL,
  	"record_type" "enum_import_mappings_record_type" NOT NULL,
  	"columns" jsonb NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "import_mappings_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" uuid
  );
  
  CREATE TABLE "_import_mappings_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"parent_id" uuid,
  	"version_name" varchar NOT NULL,
  	"version_record_type" "enum__import_mappings_v_version_record_type" NOT NULL,
  	"version_columns" jsonb NOT NULL,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_import_mappings_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" uuid
  );
  
  CREATE TABLE "payload_jobs_log" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"executed_at" timestamp(3) with time zone NOT NULL,
  	"completed_at" timestamp(3) with time zone NOT NULL,
  	"task_slug" "enum_payload_jobs_log_task_slug" NOT NULL,
  	"task_i_d" varchar NOT NULL,
  	"input" jsonb NOT NULL,
  	"output" jsonb,
  	"state" "enum_payload_jobs_log_state" NOT NULL,
  	"error" jsonb,
  	"parent_task_slug" "enum_payload_jobs_log_parent_task_slug",
  	"parent_task_i_d" varchar
  );
  
  CREATE TABLE "payload_jobs" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"input" jsonb,
  	"meta" jsonb,
  	"completed_at" timestamp(3) with time zone,
  	"total_tried" numeric DEFAULT 0,
  	"has_error" boolean DEFAULT false,
  	"error" jsonb,
  	"task_slug" "enum_payload_jobs_task_slug",
  	"queue" varchar DEFAULT 'default',
  	"wait_until" timestamp(3) with time zone,
  	"processing_until" timestamp(3) with time zone,
  	"processing_token" varchar,
  	"concurrency_key" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_jobs_stats" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"stats" jsonb,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "countries" ADD COLUMN "root_area_id" uuid;
  ALTER TABLE "_countries_v" ADD COLUMN "version_root_area_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "areas_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "offices_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "boundaries_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "imports_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "import_mappings_id" uuid;
  ALTER TABLE "site_locales" ADD COLUMN "strings_answers_for" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_seats_in_area" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_breadcrumb" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_answers_for" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_seats_in_area" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_breadcrumb" varchar;
  ALTER TABLE "areas" ADD CONSTRAINT "areas_parent_id_areas_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."areas"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "areas" ADD CONSTRAINT "areas_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "areas" ADD CONSTRAINT "areas_geo_outline_id_boundaries_id_fk" FOREIGN KEY ("geo_outline_id") REFERENCES "public"."boundaries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "areas_locales" ADD CONSTRAINT "areas_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."areas"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "areas_texts" ADD CONSTRAINT "areas_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."areas"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "areas_rels" ADD CONSTRAINT "areas_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."areas"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "areas_rels" ADD CONSTRAINT "areas_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_areas_v" ADD CONSTRAINT "_areas_v_parent_id_areas_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."areas"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_areas_v" ADD CONSTRAINT "_areas_v_version_parent_id_areas_id_fk" FOREIGN KEY ("version_parent_id") REFERENCES "public"."areas"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_areas_v" ADD CONSTRAINT "_areas_v_version_country_id_countries_id_fk" FOREIGN KEY ("version_country_id") REFERENCES "public"."countries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_areas_v" ADD CONSTRAINT "_areas_v_version_geo_outline_id_boundaries_id_fk" FOREIGN KEY ("version_geo_outline_id") REFERENCES "public"."boundaries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_areas_v_locales" ADD CONSTRAINT "_areas_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_areas_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_areas_v_texts" ADD CONSTRAINT "_areas_v_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_areas_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_areas_v_rels" ADD CONSTRAINT "_areas_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_areas_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_areas_v_rels" ADD CONSTRAINT "_areas_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "offices" ADD CONSTRAINT "offices_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "offices_locales" ADD CONSTRAINT "offices_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."offices"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "offices_rels" ADD CONSTRAINT "offices_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."offices"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "offices_rels" ADD CONSTRAINT "offices_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_offices_v" ADD CONSTRAINT "_offices_v_parent_id_offices_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."offices"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_offices_v" ADD CONSTRAINT "_offices_v_version_country_id_countries_id_fk" FOREIGN KEY ("version_country_id") REFERENCES "public"."countries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_offices_v_locales" ADD CONSTRAINT "_offices_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_offices_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_offices_v_rels" ADD CONSTRAINT "_offices_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_offices_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_offices_v_rels" ADD CONSTRAINT "_offices_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "boundaries_rels" ADD CONSTRAINT "boundaries_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."boundaries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "boundaries_rels" ADD CONSTRAINT "boundaries_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_boundaries_v" ADD CONSTRAINT "_boundaries_v_parent_id_boundaries_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."boundaries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_boundaries_v_rels" ADD CONSTRAINT "_boundaries_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_boundaries_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_boundaries_v_rels" ADD CONSTRAINT "_boundaries_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "imports_mapping" ADD CONSTRAINT "imports_mapping_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."imports"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "imports" ADD CONSTRAINT "imports_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "imports_rels" ADD CONSTRAINT "imports_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."imports"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "imports_rels" ADD CONSTRAINT "imports_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_imports_v_version_mapping" ADD CONSTRAINT "_imports_v_version_mapping_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_imports_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_imports_v" ADD CONSTRAINT "_imports_v_parent_id_imports_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."imports"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_imports_v" ADD CONSTRAINT "_imports_v_version_country_id_countries_id_fk" FOREIGN KEY ("version_country_id") REFERENCES "public"."countries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_imports_v_rels" ADD CONSTRAINT "_imports_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_imports_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_imports_v_rels" ADD CONSTRAINT "_imports_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "import_mappings_rels" ADD CONSTRAINT "import_mappings_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."import_mappings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "import_mappings_rels" ADD CONSTRAINT "import_mappings_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_import_mappings_v" ADD CONSTRAINT "_import_mappings_v_parent_id_import_mappings_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."import_mappings"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_import_mappings_v_rels" ADD CONSTRAINT "_import_mappings_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_import_mappings_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_import_mappings_v_rels" ADD CONSTRAINT "_import_mappings_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_jobs_log" ADD CONSTRAINT "payload_jobs_log_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."payload_jobs"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "areas_slug_idx" ON "areas" USING btree ("slug");
  CREATE INDEX "areas_parent_idx" ON "areas" USING btree ("parent_id");
  CREATE INDEX "areas_country_idx" ON "areas" USING btree ("country_id");
  CREATE INDEX "areas_geo_geo_outline_idx" ON "areas" USING btree ("geo_outline_id");
  CREATE INDEX "areas_updated_at_idx" ON "areas" USING btree ("updated_at");
  CREATE INDEX "areas_created_at_idx" ON "areas" USING btree ("created_at");
  CREATE UNIQUE INDEX "country_slug_idx" ON "areas" USING btree ("country_id","slug");
  CREATE UNIQUE INDEX "areas_locales_parent_id_locale_unique" ON "areas_locales" USING btree ("_parent_id","_locale");
  CREATE INDEX "areas_texts_order_parent" ON "areas_texts" USING btree ("order","parent_id");
  CREATE INDEX "areas_rels_order_idx" ON "areas_rels" USING btree ("order");
  CREATE INDEX "areas_rels_parent_idx" ON "areas_rels" USING btree ("parent_id");
  CREATE INDEX "areas_rels_path_idx" ON "areas_rels" USING btree ("path");
  CREATE INDEX "areas_rels_users_id_idx" ON "areas_rels" USING btree ("users_id");
  CREATE INDEX "_areas_v_parent_idx" ON "_areas_v" USING btree ("parent_id");
  CREATE INDEX "_areas_v_version_version_slug_idx" ON "_areas_v" USING btree ("version_slug");
  CREATE INDEX "_areas_v_version_version_parent_idx" ON "_areas_v" USING btree ("version_parent_id");
  CREATE INDEX "_areas_v_version_version_country_idx" ON "_areas_v" USING btree ("version_country_id");
  CREATE INDEX "_areas_v_version_geo_version_geo_outline_idx" ON "_areas_v" USING btree ("version_geo_outline_id");
  CREATE INDEX "_areas_v_version_version_updated_at_idx" ON "_areas_v" USING btree ("version_updated_at");
  CREATE INDEX "_areas_v_version_version_created_at_idx" ON "_areas_v" USING btree ("version_created_at");
  CREATE INDEX "_areas_v_created_at_idx" ON "_areas_v" USING btree ("created_at");
  CREATE INDEX "_areas_v_updated_at_idx" ON "_areas_v" USING btree ("updated_at");
  CREATE INDEX "version_country_version_slug_idx" ON "_areas_v" USING btree ("version_country_id","version_slug");
  CREATE UNIQUE INDEX "_areas_v_locales_parent_id_locale_unique" ON "_areas_v_locales" USING btree ("_parent_id","_locale");
  CREATE INDEX "_areas_v_texts_order_parent" ON "_areas_v_texts" USING btree ("order","parent_id");
  CREATE INDEX "_areas_v_rels_order_idx" ON "_areas_v_rels" USING btree ("order");
  CREATE INDEX "_areas_v_rels_parent_idx" ON "_areas_v_rels" USING btree ("parent_id");
  CREATE INDEX "_areas_v_rels_path_idx" ON "_areas_v_rels" USING btree ("path");
  CREATE INDEX "_areas_v_rels_users_id_idx" ON "_areas_v_rels" USING btree ("users_id");
  CREATE INDEX "offices_slug_idx" ON "offices" USING btree ("slug");
  CREATE INDEX "offices_country_idx" ON "offices" USING btree ("country_id");
  CREATE INDEX "offices_updated_at_idx" ON "offices" USING btree ("updated_at");
  CREATE INDEX "offices_created_at_idx" ON "offices" USING btree ("created_at");
  CREATE UNIQUE INDEX "country_slug_1_idx" ON "offices" USING btree ("country_id","slug");
  CREATE UNIQUE INDEX "offices_locales_parent_id_locale_unique" ON "offices_locales" USING btree ("_parent_id","_locale");
  CREATE INDEX "offices_rels_order_idx" ON "offices_rels" USING btree ("order");
  CREATE INDEX "offices_rels_parent_idx" ON "offices_rels" USING btree ("parent_id");
  CREATE INDEX "offices_rels_path_idx" ON "offices_rels" USING btree ("path");
  CREATE INDEX "offices_rels_users_id_idx" ON "offices_rels" USING btree ("users_id");
  CREATE INDEX "_offices_v_parent_idx" ON "_offices_v" USING btree ("parent_id");
  CREATE INDEX "_offices_v_version_version_slug_idx" ON "_offices_v" USING btree ("version_slug");
  CREATE INDEX "_offices_v_version_version_country_idx" ON "_offices_v" USING btree ("version_country_id");
  CREATE INDEX "_offices_v_version_version_updated_at_idx" ON "_offices_v" USING btree ("version_updated_at");
  CREATE INDEX "_offices_v_version_version_created_at_idx" ON "_offices_v" USING btree ("version_created_at");
  CREATE INDEX "_offices_v_created_at_idx" ON "_offices_v" USING btree ("created_at");
  CREATE INDEX "_offices_v_updated_at_idx" ON "_offices_v" USING btree ("updated_at");
  CREATE INDEX "version_country_version_slug_1_idx" ON "_offices_v" USING btree ("version_country_id","version_slug");
  CREATE UNIQUE INDEX "_offices_v_locales_parent_id_locale_unique" ON "_offices_v_locales" USING btree ("_parent_id","_locale");
  CREATE INDEX "_offices_v_rels_order_idx" ON "_offices_v_rels" USING btree ("order");
  CREATE INDEX "_offices_v_rels_parent_idx" ON "_offices_v_rels" USING btree ("parent_id");
  CREATE INDEX "_offices_v_rels_path_idx" ON "_offices_v_rels" USING btree ("path");
  CREATE INDEX "_offices_v_rels_users_id_idx" ON "_offices_v_rels" USING btree ("users_id");
  CREATE INDEX "boundaries_updated_at_idx" ON "boundaries" USING btree ("updated_at");
  CREATE INDEX "boundaries_created_at_idx" ON "boundaries" USING btree ("created_at");
  CREATE UNIQUE INDEX "boundaries_filename_idx" ON "boundaries" USING btree ("filename");
  CREATE INDEX "boundaries_original_original_filename_idx" ON "boundaries" USING btree ("original_filename");
  CREATE INDEX "boundaries_rels_order_idx" ON "boundaries_rels" USING btree ("order");
  CREATE INDEX "boundaries_rels_parent_idx" ON "boundaries_rels" USING btree ("parent_id");
  CREATE INDEX "boundaries_rels_path_idx" ON "boundaries_rels" USING btree ("path");
  CREATE INDEX "boundaries_rels_users_id_idx" ON "boundaries_rels" USING btree ("users_id");
  CREATE INDEX "_boundaries_v_parent_idx" ON "_boundaries_v" USING btree ("parent_id");
  CREATE INDEX "_boundaries_v_version_version_updated_at_idx" ON "_boundaries_v" USING btree ("version_updated_at");
  CREATE INDEX "_boundaries_v_version_version_created_at_idx" ON "_boundaries_v" USING btree ("version_created_at");
  CREATE INDEX "_boundaries_v_version_version_filename_idx" ON "_boundaries_v" USING btree ("version_filename");
  CREATE INDEX "_boundaries_v_version_original_version_original_filename_idx" ON "_boundaries_v" USING btree ("version_original_filename");
  CREATE INDEX "_boundaries_v_created_at_idx" ON "_boundaries_v" USING btree ("created_at");
  CREATE INDEX "_boundaries_v_updated_at_idx" ON "_boundaries_v" USING btree ("updated_at");
  CREATE INDEX "_boundaries_v_rels_order_idx" ON "_boundaries_v_rels" USING btree ("order");
  CREATE INDEX "_boundaries_v_rels_parent_idx" ON "_boundaries_v_rels" USING btree ("parent_id");
  CREATE INDEX "_boundaries_v_rels_path_idx" ON "_boundaries_v_rels" USING btree ("path");
  CREATE INDEX "_boundaries_v_rels_users_id_idx" ON "_boundaries_v_rels" USING btree ("users_id");
  CREATE INDEX "imports_mapping_order_idx" ON "imports_mapping" USING btree ("_order");
  CREATE INDEX "imports_mapping_parent_id_idx" ON "imports_mapping" USING btree ("_parent_id");
  CREATE INDEX "imports_country_idx" ON "imports" USING btree ("country_id");
  CREATE INDEX "imports_updated_at_idx" ON "imports" USING btree ("updated_at");
  CREATE INDEX "imports_created_at_idx" ON "imports" USING btree ("created_at");
  CREATE UNIQUE INDEX "imports_filename_idx" ON "imports" USING btree ("filename");
  CREATE INDEX "imports_original_original_filename_idx" ON "imports" USING btree ("original_filename");
  CREATE INDEX "imports_rels_order_idx" ON "imports_rels" USING btree ("order");
  CREATE INDEX "imports_rels_parent_idx" ON "imports_rels" USING btree ("parent_id");
  CREATE INDEX "imports_rels_path_idx" ON "imports_rels" USING btree ("path");
  CREATE INDEX "imports_rels_users_id_idx" ON "imports_rels" USING btree ("users_id");
  CREATE INDEX "_imports_v_version_mapping_order_idx" ON "_imports_v_version_mapping" USING btree ("_order");
  CREATE INDEX "_imports_v_version_mapping_parent_id_idx" ON "_imports_v_version_mapping" USING btree ("_parent_id");
  CREATE INDEX "_imports_v_parent_idx" ON "_imports_v" USING btree ("parent_id");
  CREATE INDEX "_imports_v_version_version_country_idx" ON "_imports_v" USING btree ("version_country_id");
  CREATE INDEX "_imports_v_version_version_updated_at_idx" ON "_imports_v" USING btree ("version_updated_at");
  CREATE INDEX "_imports_v_version_version_created_at_idx" ON "_imports_v" USING btree ("version_created_at");
  CREATE INDEX "_imports_v_version_version_filename_idx" ON "_imports_v" USING btree ("version_filename");
  CREATE INDEX "_imports_v_version_original_version_original_filename_idx" ON "_imports_v" USING btree ("version_original_filename");
  CREATE INDEX "_imports_v_created_at_idx" ON "_imports_v" USING btree ("created_at");
  CREATE INDEX "_imports_v_updated_at_idx" ON "_imports_v" USING btree ("updated_at");
  CREATE INDEX "_imports_v_rels_order_idx" ON "_imports_v_rels" USING btree ("order");
  CREATE INDEX "_imports_v_rels_parent_idx" ON "_imports_v_rels" USING btree ("parent_id");
  CREATE INDEX "_imports_v_rels_path_idx" ON "_imports_v_rels" USING btree ("path");
  CREATE INDEX "_imports_v_rels_users_id_idx" ON "_imports_v_rels" USING btree ("users_id");
  CREATE INDEX "import_mappings_updated_at_idx" ON "import_mappings" USING btree ("updated_at");
  CREATE INDEX "import_mappings_created_at_idx" ON "import_mappings" USING btree ("created_at");
  CREATE INDEX "import_mappings_rels_order_idx" ON "import_mappings_rels" USING btree ("order");
  CREATE INDEX "import_mappings_rels_parent_idx" ON "import_mappings_rels" USING btree ("parent_id");
  CREATE INDEX "import_mappings_rels_path_idx" ON "import_mappings_rels" USING btree ("path");
  CREATE INDEX "import_mappings_rels_users_id_idx" ON "import_mappings_rels" USING btree ("users_id");
  CREATE INDEX "_import_mappings_v_parent_idx" ON "_import_mappings_v" USING btree ("parent_id");
  CREATE INDEX "_import_mappings_v_version_version_updated_at_idx" ON "_import_mappings_v" USING btree ("version_updated_at");
  CREATE INDEX "_import_mappings_v_version_version_created_at_idx" ON "_import_mappings_v" USING btree ("version_created_at");
  CREATE INDEX "_import_mappings_v_created_at_idx" ON "_import_mappings_v" USING btree ("created_at");
  CREATE INDEX "_import_mappings_v_updated_at_idx" ON "_import_mappings_v" USING btree ("updated_at");
  CREATE INDEX "_import_mappings_v_rels_order_idx" ON "_import_mappings_v_rels" USING btree ("order");
  CREATE INDEX "_import_mappings_v_rels_parent_idx" ON "_import_mappings_v_rels" USING btree ("parent_id");
  CREATE INDEX "_import_mappings_v_rels_path_idx" ON "_import_mappings_v_rels" USING btree ("path");
  CREATE INDEX "_import_mappings_v_rels_users_id_idx" ON "_import_mappings_v_rels" USING btree ("users_id");
  CREATE INDEX "payload_jobs_log_order_idx" ON "payload_jobs_log" USING btree ("_order");
  CREATE INDEX "payload_jobs_log_parent_id_idx" ON "payload_jobs_log" USING btree ("_parent_id");
  CREATE INDEX "payload_jobs_completed_at_idx" ON "payload_jobs" USING btree ("completed_at");
  CREATE INDEX "payload_jobs_total_tried_idx" ON "payload_jobs" USING btree ("total_tried");
  CREATE INDEX "payload_jobs_has_error_idx" ON "payload_jobs" USING btree ("has_error");
  CREATE INDEX "payload_jobs_task_slug_idx" ON "payload_jobs" USING btree ("task_slug");
  CREATE INDEX "payload_jobs_queue_idx" ON "payload_jobs" USING btree ("queue");
  CREATE INDEX "payload_jobs_wait_until_idx" ON "payload_jobs" USING btree ("wait_until");
  CREATE INDEX "payload_jobs_processing_until_idx" ON "payload_jobs" USING btree ("processing_until");
  CREATE INDEX "payload_jobs_concurrency_key_idx" ON "payload_jobs" USING btree ("concurrency_key");
  CREATE INDEX "payload_jobs_updated_at_idx" ON "payload_jobs" USING btree ("updated_at");
  CREATE INDEX "payload_jobs_created_at_idx" ON "payload_jobs" USING btree ("created_at");
  ALTER TABLE "countries" ADD CONSTRAINT "countries_root_area_id_areas_id_fk" FOREIGN KEY ("root_area_id") REFERENCES "public"."areas"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_countries_v" ADD CONSTRAINT "_countries_v_version_root_area_id_areas_id_fk" FOREIGN KEY ("version_root_area_id") REFERENCES "public"."areas"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_areas_fk" FOREIGN KEY ("areas_id") REFERENCES "public"."areas"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_offices_fk" FOREIGN KEY ("offices_id") REFERENCES "public"."offices"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_boundaries_fk" FOREIGN KEY ("boundaries_id") REFERENCES "public"."boundaries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_imports_fk" FOREIGN KEY ("imports_id") REFERENCES "public"."imports"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_import_mappings_fk" FOREIGN KEY ("import_mappings_id") REFERENCES "public"."import_mappings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "countries_root_area_idx" ON "countries" USING btree ("root_area_id");
  CREATE INDEX "_countries_v_version_version_root_area_idx" ON "_countries_v" USING btree ("version_root_area_id");
  CREATE INDEX "payload_locked_documents_rels_areas_id_idx" ON "payload_locked_documents_rels" USING btree ("areas_id");
  CREATE INDEX "payload_locked_documents_rels_offices_id_idx" ON "payload_locked_documents_rels" USING btree ("offices_id");
  CREATE INDEX "payload_locked_documents_rels_boundaries_id_idx" ON "payload_locked_documents_rels" USING btree ("boundaries_id");
  CREATE INDEX "payload_locked_documents_rels_imports_id_idx" ON "payload_locked_documents_rels" USING btree ("imports_id");
  CREATE INDEX "payload_locked_documents_rels_import_mappings_id_idx" ON "payload_locked_documents_rels" USING btree ("import_mappings_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "areas" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "areas_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "areas_texts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "areas_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_areas_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_areas_v_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_areas_v_texts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_areas_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "offices" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "offices_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "offices_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_offices_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_offices_v_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_offices_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "boundaries" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "boundaries_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_boundaries_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_boundaries_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "imports_mapping" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "imports" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "imports_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_imports_v_version_mapping" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_imports_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_imports_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "import_mappings" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "import_mappings_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_import_mappings_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_import_mappings_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_jobs_log" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_jobs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_jobs_stats" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "areas" CASCADE;
  DROP TABLE "areas_locales" CASCADE;
  DROP TABLE "areas_texts" CASCADE;
  DROP TABLE "areas_rels" CASCADE;
  DROP TABLE "_areas_v" CASCADE;
  DROP TABLE "_areas_v_locales" CASCADE;
  DROP TABLE "_areas_v_texts" CASCADE;
  DROP TABLE "_areas_v_rels" CASCADE;
  DROP TABLE "offices" CASCADE;
  DROP TABLE "offices_locales" CASCADE;
  DROP TABLE "offices_rels" CASCADE;
  DROP TABLE "_offices_v" CASCADE;
  DROP TABLE "_offices_v_locales" CASCADE;
  DROP TABLE "_offices_v_rels" CASCADE;
  DROP TABLE "boundaries" CASCADE;
  DROP TABLE "boundaries_rels" CASCADE;
  DROP TABLE "_boundaries_v" CASCADE;
  DROP TABLE "_boundaries_v_rels" CASCADE;
  DROP TABLE "imports_mapping" CASCADE;
  DROP TABLE "imports" CASCADE;
  DROP TABLE "imports_rels" CASCADE;
  DROP TABLE "_imports_v_version_mapping" CASCADE;
  DROP TABLE "_imports_v" CASCADE;
  DROP TABLE "_imports_v_rels" CASCADE;
  DROP TABLE "import_mappings" CASCADE;
  DROP TABLE "import_mappings_rels" CASCADE;
  DROP TABLE "_import_mappings_v" CASCADE;
  DROP TABLE "_import_mappings_v_rels" CASCADE;
  DROP TABLE "payload_jobs_log" CASCADE;
  DROP TABLE "payload_jobs" CASCADE;
  DROP TABLE "payload_jobs_stats" CASCADE;
  ALTER TABLE "countries" DROP CONSTRAINT IF EXISTS "countries_root_area_id_areas_id_fk";
  
  ALTER TABLE "_countries_v" DROP CONSTRAINT IF EXISTS "_countries_v_version_root_area_id_areas_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_areas_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_offices_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_boundaries_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_imports_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_import_mappings_fk";
  
  DROP INDEX IF EXISTS "countries_root_area_idx";
  DROP INDEX IF EXISTS "_countries_v_version_version_root_area_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_areas_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_offices_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_boundaries_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_imports_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_import_mappings_id_idx";
  ALTER TABLE "countries" DROP COLUMN "root_area_id";
  ALTER TABLE "_countries_v" DROP COLUMN "version_root_area_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "areas_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "offices_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "boundaries_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "imports_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "import_mappings_id";
  ALTER TABLE "site_locales" DROP COLUMN "strings_answers_for";
  ALTER TABLE "site_locales" DROP COLUMN "strings_seats_in_area";
  ALTER TABLE "site_locales" DROP COLUMN "strings_breadcrumb";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_answers_for";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_seats_in_area";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_breadcrumb";
  DROP TYPE "public"."enum_areas_type";
  DROP TYPE "public"."enum_areas_page";
  DROP TYPE "public"."enum__areas_v_version_type";
  DROP TYPE "public"."enum__areas_v_version_page";
  DROP TYPE "public"."enum_offices_area_type";
  DROP TYPE "public"."enum__offices_v_version_area_type";
  DROP TYPE "public"."enum_imports_mapping_field";
  DROP TYPE "public"."enum_imports_record_type";
  DROP TYPE "public"."enum_imports_next_step";
  DROP TYPE "public"."enum_imports_status";
  DROP TYPE "public"."enum__imports_v_version_mapping_field";
  DROP TYPE "public"."enum__imports_v_version_record_type";
  DROP TYPE "public"."enum__imports_v_version_next_step";
  DROP TYPE "public"."enum__imports_v_version_status";
  DROP TYPE "public"."enum_import_mappings_record_type";
  DROP TYPE "public"."enum__import_mappings_v_version_record_type";
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  DROP TYPE "public"."enum_payload_jobs_log_state";
  DROP TYPE "public"."enum_payload_jobs_log_parent_task_slug";
  DROP TYPE "public"."enum_payload_jobs_task_slug";`)
}
