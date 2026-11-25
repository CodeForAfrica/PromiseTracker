import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_extractions_candidates_decision" AS ENUM('pending', 'accepted', 'rejected');
  CREATE TYPE "public"."enum_extractions_status" AS ENUM('running', 'completed', 'failed');
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'extractCandidates';
  ALTER TYPE "public"."enum_payload_jobs_log_parent_task_slug" ADD VALUE 'extractCandidates';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'extractCandidates';
  CREATE TABLE "extractions_candidates" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"summary" varchar,
  	"topic" varchar,
  	"confidence" numeric,
  	"decision" "enum_extractions_candidates_decision" DEFAULT 'pending',
  	"reason" varchar,
  	"reviewer_id" uuid,
  	"reviewed_at" timestamp(3) with time zone,
  	"claim_id" uuid
  );
  
  CREATE TABLE "extractions" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"document_id" uuid,
  	"status" "enum_extractions_status" DEFAULT 'running' NOT NULL,
  	"message" varchar,
  	"model" varchar NOT NULL,
  	"prompt_version" varchar,
  	"sections" numeric,
  	"input_tokens" numeric,
  	"output_tokens" numeric,
  	"pending" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "extractions_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "extractions_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" uuid
  );
  
  ALTER TABLE "claims" ADD COLUMN "ai_extraction_id" uuid;
  ALTER TABLE "claims" ADD COLUMN "ai_candidate" varchar;
  ALTER TABLE "_claims_v" ADD COLUMN "version_ai_extraction_id" uuid;
  ALTER TABLE "_claims_v" ADD COLUMN "version_ai_candidate" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "extractions_id" uuid;
  ALTER TABLE "settings" ADD COLUMN "ai_api_key" varchar;
  ALTER TABLE "settings" ADD COLUMN "ai_base_url" varchar;
  ALTER TABLE "extractions_candidates" ADD CONSTRAINT "extractions_candidates_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "extractions_candidates" ADD CONSTRAINT "extractions_candidates_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "extractions_candidates" ADD CONSTRAINT "extractions_candidates_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."extractions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "extractions" ADD CONSTRAINT "extractions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "extractions_texts" ADD CONSTRAINT "extractions_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."extractions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "extractions_rels" ADD CONSTRAINT "extractions_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."extractions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "extractions_rels" ADD CONSTRAINT "extractions_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "extractions_candidates_order_idx" ON "extractions_candidates" USING btree ("_order");
  CREATE INDEX "extractions_candidates_parent_id_idx" ON "extractions_candidates" USING btree ("_parent_id");
  CREATE INDEX "extractions_candidates_reviewer_idx" ON "extractions_candidates" USING btree ("reviewer_id");
  CREATE INDEX "extractions_candidates_claim_idx" ON "extractions_candidates" USING btree ("claim_id");
  CREATE INDEX "extractions_document_idx" ON "extractions" USING btree ("document_id");
  CREATE INDEX "extractions_updated_at_idx" ON "extractions" USING btree ("updated_at");
  CREATE INDEX "extractions_created_at_idx" ON "extractions" USING btree ("created_at");
  CREATE INDEX "extractions_texts_order_parent" ON "extractions_texts" USING btree ("order","parent_id");
  CREATE INDEX "extractions_rels_order_idx" ON "extractions_rels" USING btree ("order");
  CREATE INDEX "extractions_rels_parent_idx" ON "extractions_rels" USING btree ("parent_id");
  CREATE INDEX "extractions_rels_path_idx" ON "extractions_rels" USING btree ("path");
  CREATE INDEX "extractions_rels_users_id_idx" ON "extractions_rels" USING btree ("users_id");
  ALTER TABLE "claims" ADD CONSTRAINT "claims_ai_extraction_id_extractions_id_fk" FOREIGN KEY ("ai_extraction_id") REFERENCES "public"."extractions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_claims_v" ADD CONSTRAINT "_claims_v_version_ai_extraction_id_extractions_id_fk" FOREIGN KEY ("version_ai_extraction_id") REFERENCES "public"."extractions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_extractions_fk" FOREIGN KEY ("extractions_id") REFERENCES "public"."extractions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "claims_ai_ai_extraction_idx" ON "claims" USING btree ("ai_extraction_id");
  CREATE INDEX "_claims_v_version_ai_version_ai_extraction_idx" ON "_claims_v" USING btree ("version_ai_extraction_id");
  CREATE INDEX "payload_locked_documents_rels_extractions_id_idx" ON "payload_locked_documents_rels" USING btree ("extractions_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   -- Jobs for the task this removes go first: the old enum types do not have its name.
  DELETE FROM "payload_jobs_log" WHERE "task_slug"::text = 'extractCandidates' OR "parent_task_slug"::text = 'extractCandidates';
  DELETE FROM "payload_jobs" WHERE "task_slug"::text = 'extractCandidates';
   ALTER TABLE "extractions_candidates" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "extractions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "extractions_texts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "extractions_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "extractions_candidates" CASCADE;
  DROP TABLE "extractions" CASCADE;
  DROP TABLE "extractions_texts" CASCADE;
  DROP TABLE "extractions_rels" CASCADE;
  ALTER TABLE "claims" DROP CONSTRAINT IF EXISTS "claims_ai_extraction_id_extractions_id_fk";
  
  ALTER TABLE "_claims_v" DROP CONSTRAINT IF EXISTS "_claims_v_version_ai_extraction_id_extractions_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_extractions_fk";
  
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'runImport', 'fetchDocument', 'extractText', 'cleanupJobs', 'cascadePublishing', 'recomputePublishing', 'dailyPublishing', 'refreshCounts');
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_log_task_slug" USING "task_slug"::"public"."enum_payload_jobs_log_task_slug";
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "parent_task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_log_parent_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_log_parent_task_slug" AS ENUM('inline', 'runImport', 'fetchDocument', 'extractText', 'cleanupJobs', 'cascadePublishing', 'recomputePublishing', 'dailyPublishing', 'refreshCounts');
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "parent_task_slug" SET DATA TYPE "public"."enum_payload_jobs_log_parent_task_slug" USING "parent_task_slug"::"public"."enum_payload_jobs_log_parent_task_slug";
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'runImport', 'fetchDocument', 'extractText', 'cleanupJobs', 'cascadePublishing', 'recomputePublishing', 'dailyPublishing', 'refreshCounts');
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_task_slug" USING "task_slug"::"public"."enum_payload_jobs_task_slug";
  DROP INDEX "claims_ai_ai_extraction_idx";
  DROP INDEX "_claims_v_version_ai_version_ai_extraction_idx";
  DROP INDEX "payload_locked_documents_rels_extractions_id_idx";
  ALTER TABLE "claims" DROP COLUMN "ai_extraction_id";
  ALTER TABLE "claims" DROP COLUMN "ai_candidate";
  ALTER TABLE "_claims_v" DROP COLUMN "version_ai_extraction_id";
  ALTER TABLE "_claims_v" DROP COLUMN "version_ai_candidate";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "extractions_id";
  ALTER TABLE "settings" DROP COLUMN "ai_api_key";
  ALTER TABLE "settings" DROP COLUMN "ai_base_url";
  DROP TYPE "public"."enum_extractions_candidates_decision";
  DROP TYPE "public"."enum_extractions_status";`)
}
