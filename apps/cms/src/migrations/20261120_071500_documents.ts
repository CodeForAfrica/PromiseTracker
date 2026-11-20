import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_documents_type" AS ENUM('claims', 'evidence');
  CREATE TYPE "public"."enum_documents_language" AS ENUM('en', 'fr', 'pt', 'ar', 'sw');
  CREATE TYPE "public"."enum_documents_connector" AS ENUM('upload', 'url');
  CREATE TYPE "public"."enum_documents_status" AS ENUM('pending', 'fetching', 'fetched', 'extracting', 'extracted', 'analysing', 'analysed', 'imported', 'completed', 'failed', 'needs-review');
  CREATE TYPE "public"."enum__documents_v_version_type" AS ENUM('claims', 'evidence');
  CREATE TYPE "public"."enum__documents_v_version_language" AS ENUM('en', 'fr', 'pt', 'ar', 'sw');
  CREATE TYPE "public"."enum__documents_v_version_connector" AS ENUM('upload', 'url');
  CREATE TYPE "public"."enum__documents_v_version_status" AS ENUM('pending', 'fetching', 'fetched', 'extracting', 'extracted', 'analysing', 'analysed', 'imported', 'completed', 'failed', 'needs-review');
  CREATE TYPE "public"."enum_payload_jobs_workflow_slug" AS ENUM('processDocument');
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'fetchDocument';
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'extractText';
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'cleanupJobs';
  ALTER TYPE "public"."enum_payload_jobs_log_parent_task_slug" ADD VALUE 'fetchDocument';
  ALTER TYPE "public"."enum_payload_jobs_log_parent_task_slug" ADD VALUE 'extractText';
  ALTER TYPE "public"."enum_payload_jobs_log_parent_task_slug" ADD VALUE 'cleanupJobs';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'fetchDocument';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'extractText';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'cleanupJobs';
  CREATE TABLE "documents" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"title" varchar NOT NULL,
  	"country_id" uuid NOT NULL,
  	"type" "enum_documents_type" DEFAULT 'claims',
  	"language" "enum_documents_language",
  	"publisher" varchar,
  	"date" timestamp(3) with time zone,
  	"connector" "enum_documents_connector" DEFAULT 'upload' NOT NULL,
  	"file_id" uuid,
  	"source_url" varchar,
  	"status" "enum_documents_status" DEFAULT 'pending',
  	"status_message" varchar,
  	"retry_count" numeric DEFAULT 0,
  	"last_attempt_at" timestamp(3) with time zone,
  	"detected_type" varchar,
  	"page_count" numeric,
  	"text" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"actors_id" uuid,
  	"users_id" uuid
  );
  
  CREATE TABLE "_documents_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"parent_id" uuid,
  	"version_title" varchar NOT NULL,
  	"version_country_id" uuid NOT NULL,
  	"version_type" "enum__documents_v_version_type" DEFAULT 'claims',
  	"version_language" "enum__documents_v_version_language",
  	"version_publisher" varchar,
  	"version_date" timestamp(3) with time zone,
  	"version_connector" "enum__documents_v_version_connector" DEFAULT 'upload' NOT NULL,
  	"version_file_id" uuid,
  	"version_source_url" varchar,
  	"version_status" "enum__documents_v_version_status" DEFAULT 'pending',
  	"version_status_message" varchar,
  	"version_retry_count" numeric DEFAULT 0,
  	"version_last_attempt_at" timestamp(3) with time zone,
  	"version_detected_type" varchar,
  	"version_page_count" numeric,
  	"version_text" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_documents_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"actors_id" uuid,
  	"users_id" uuid
  );
  
  CREATE TABLE "document_files" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"credit" varchar,
  	"checksum" varchar,
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
  
  CREATE TABLE "document_files_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" uuid
  );
  
  CREATE TABLE "_document_files_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"parent_id" uuid,
  	"version_credit" varchar,
  	"version_checksum" varchar,
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
  
  CREATE TABLE "_document_files_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" uuid
  );
  
  ALTER TABLE "payload_jobs" ADD COLUMN "workflow_slug" "enum_payload_jobs_workflow_slug";
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "documents_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "document_files_id" uuid;
  ALTER TABLE "documents" ADD CONSTRAINT "documents_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "documents" ADD CONSTRAINT "documents_file_id_document_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."document_files"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "documents_rels" ADD CONSTRAINT "documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "documents_rels" ADD CONSTRAINT "documents_rels_actors_fk" FOREIGN KEY ("actors_id") REFERENCES "public"."actors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "documents_rels" ADD CONSTRAINT "documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_documents_v" ADD CONSTRAINT "_documents_v_parent_id_documents_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_documents_v" ADD CONSTRAINT "_documents_v_version_country_id_countries_id_fk" FOREIGN KEY ("version_country_id") REFERENCES "public"."countries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_documents_v" ADD CONSTRAINT "_documents_v_version_file_id_document_files_id_fk" FOREIGN KEY ("version_file_id") REFERENCES "public"."document_files"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_documents_v_rels" ADD CONSTRAINT "_documents_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_documents_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_documents_v_rels" ADD CONSTRAINT "_documents_v_rels_actors_fk" FOREIGN KEY ("actors_id") REFERENCES "public"."actors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_documents_v_rels" ADD CONSTRAINT "_documents_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "document_files_rels" ADD CONSTRAINT "document_files_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."document_files"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "document_files_rels" ADD CONSTRAINT "document_files_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_document_files_v" ADD CONSTRAINT "_document_files_v_parent_id_document_files_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."document_files"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_document_files_v_rels" ADD CONSTRAINT "_document_files_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_document_files_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_document_files_v_rels" ADD CONSTRAINT "_document_files_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "documents_country_idx" ON "documents" USING btree ("country_id");
  CREATE INDEX "documents_file_idx" ON "documents" USING btree ("file_id");
  CREATE INDEX "documents_status_idx" ON "documents" USING btree ("status");
  CREATE INDEX "documents_updated_at_idx" ON "documents" USING btree ("updated_at");
  CREATE INDEX "documents_created_at_idx" ON "documents" USING btree ("created_at");
  CREATE INDEX "status_lastAttemptAt_idx" ON "documents" USING btree ("status","last_attempt_at");
  CREATE INDEX "documents_rels_order_idx" ON "documents_rels" USING btree ("order");
  CREATE INDEX "documents_rels_parent_idx" ON "documents_rels" USING btree ("parent_id");
  CREATE INDEX "documents_rels_path_idx" ON "documents_rels" USING btree ("path");
  CREATE INDEX "documents_rels_actors_id_idx" ON "documents_rels" USING btree ("actors_id");
  CREATE INDEX "documents_rels_users_id_idx" ON "documents_rels" USING btree ("users_id");
  CREATE INDEX "_documents_v_parent_idx" ON "_documents_v" USING btree ("parent_id");
  CREATE INDEX "_documents_v_version_version_country_idx" ON "_documents_v" USING btree ("version_country_id");
  CREATE INDEX "_documents_v_version_version_file_idx" ON "_documents_v" USING btree ("version_file_id");
  CREATE INDEX "_documents_v_version_version_status_idx" ON "_documents_v" USING btree ("version_status");
  CREATE INDEX "_documents_v_version_version_updated_at_idx" ON "_documents_v" USING btree ("version_updated_at");
  CREATE INDEX "_documents_v_version_version_created_at_idx" ON "_documents_v" USING btree ("version_created_at");
  CREATE INDEX "_documents_v_created_at_idx" ON "_documents_v" USING btree ("created_at");
  CREATE INDEX "_documents_v_updated_at_idx" ON "_documents_v" USING btree ("updated_at");
  CREATE INDEX "version_status_version_lastAttemptAt_idx" ON "_documents_v" USING btree ("version_status","version_last_attempt_at");
  CREATE INDEX "_documents_v_rels_order_idx" ON "_documents_v_rels" USING btree ("order");
  CREATE INDEX "_documents_v_rels_parent_idx" ON "_documents_v_rels" USING btree ("parent_id");
  CREATE INDEX "_documents_v_rels_path_idx" ON "_documents_v_rels" USING btree ("path");
  CREATE INDEX "_documents_v_rels_actors_id_idx" ON "_documents_v_rels" USING btree ("actors_id");
  CREATE INDEX "_documents_v_rels_users_id_idx" ON "_documents_v_rels" USING btree ("users_id");
  CREATE UNIQUE INDEX "document_files_checksum_idx" ON "document_files" USING btree ("checksum");
  CREATE INDEX "document_files_updated_at_idx" ON "document_files" USING btree ("updated_at");
  CREATE INDEX "document_files_created_at_idx" ON "document_files" USING btree ("created_at");
  CREATE UNIQUE INDEX "document_files_filename_idx" ON "document_files" USING btree ("filename");
  CREATE INDEX "document_files_original_original_filename_idx" ON "document_files" USING btree ("original_filename");
  CREATE INDEX "document_files_rels_order_idx" ON "document_files_rels" USING btree ("order");
  CREATE INDEX "document_files_rels_parent_idx" ON "document_files_rels" USING btree ("parent_id");
  CREATE INDEX "document_files_rels_path_idx" ON "document_files_rels" USING btree ("path");
  CREATE INDEX "document_files_rels_users_id_idx" ON "document_files_rels" USING btree ("users_id");
  CREATE INDEX "_document_files_v_parent_idx" ON "_document_files_v" USING btree ("parent_id");
  CREATE INDEX "_document_files_v_version_version_checksum_idx" ON "_document_files_v" USING btree ("version_checksum");
  CREATE INDEX "_document_files_v_version_version_updated_at_idx" ON "_document_files_v" USING btree ("version_updated_at");
  CREATE INDEX "_document_files_v_version_version_created_at_idx" ON "_document_files_v" USING btree ("version_created_at");
  CREATE INDEX "_document_files_v_version_version_filename_idx" ON "_document_files_v" USING btree ("version_filename");
  CREATE INDEX "_document_files_v_version_original_version_original_file_idx" ON "_document_files_v" USING btree ("version_original_filename");
  CREATE INDEX "_document_files_v_created_at_idx" ON "_document_files_v" USING btree ("created_at");
  CREATE INDEX "_document_files_v_updated_at_idx" ON "_document_files_v" USING btree ("updated_at");
  CREATE INDEX "_document_files_v_rels_order_idx" ON "_document_files_v_rels" USING btree ("order");
  CREATE INDEX "_document_files_v_rels_parent_idx" ON "_document_files_v_rels" USING btree ("parent_id");
  CREATE INDEX "_document_files_v_rels_path_idx" ON "_document_files_v_rels" USING btree ("path");
  CREATE INDEX "_document_files_v_rels_users_id_idx" ON "_document_files_v_rels" USING btree ("users_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_documents_fk" FOREIGN KEY ("documents_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_document_files_fk" FOREIGN KEY ("document_files_id") REFERENCES "public"."document_files"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_jobs_workflow_slug_idx" ON "payload_jobs" USING btree ("workflow_slug");
  CREATE INDEX "payload_locked_documents_rels_documents_id_idx" ON "payload_locked_documents_rels" USING btree ("documents_id");
  CREATE INDEX "payload_locked_documents_rels_document_files_id_idx" ON "payload_locked_documents_rels" USING btree ("document_files_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "documents" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "documents_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_documents_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_documents_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "document_files" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "document_files_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_document_files_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_document_files_v_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE IF EXISTS "documents" CASCADE;
  DROP TABLE IF EXISTS "documents_rels" CASCADE;
  DROP TABLE IF EXISTS "_documents_v" CASCADE;
  DROP TABLE IF EXISTS "_documents_v_rels" CASCADE;
  DROP TABLE IF EXISTS "document_files" CASCADE;
  DROP TABLE IF EXISTS "document_files_rels" CASCADE;
  DROP TABLE IF EXISTS "_document_files_v" CASCADE;
  DROP TABLE IF EXISTS "_document_files_v_rels" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_documents_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_document_files_fk";
  
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE IF EXISTS "public"."enum_payload_jobs_log_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'runImport');
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_log_task_slug" USING "task_slug"::"public"."enum_payload_jobs_log_task_slug";
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "parent_task_slug" SET DATA TYPE text;
  DROP TYPE IF EXISTS "public"."enum_payload_jobs_log_parent_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_log_parent_task_slug" AS ENUM('inline', 'runImport');
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "parent_task_slug" SET DATA TYPE "public"."enum_payload_jobs_log_parent_task_slug" USING "parent_task_slug"::"public"."enum_payload_jobs_log_parent_task_slug";
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE IF EXISTS "public"."enum_payload_jobs_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'runImport');
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_task_slug" USING "task_slug"::"public"."enum_payload_jobs_task_slug";
  DROP INDEX IF EXISTS "payload_jobs_workflow_slug_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_documents_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_document_files_id_idx";
  ALTER TABLE "payload_jobs" DROP COLUMN IF EXISTS "workflow_slug";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "documents_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "document_files_id";
  DROP TYPE IF EXISTS "public"."enum_documents_type";
  DROP TYPE IF EXISTS "public"."enum_documents_language";
  DROP TYPE IF EXISTS "public"."enum_documents_connector";
  DROP TYPE IF EXISTS "public"."enum_documents_status";
  DROP TYPE IF EXISTS "public"."enum__documents_v_version_type";
  DROP TYPE IF EXISTS "public"."enum__documents_v_version_language";
  DROP TYPE IF EXISTS "public"."enum__documents_v_version_connector";
  DROP TYPE IF EXISTS "public"."enum__documents_v_version_status";
  DROP TYPE IF EXISTS "public"."enum_payload_jobs_workflow_slug";`)
}
