import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_submissions_kind" AS ENUM('evidence', 'correction', 'changed');
  CREATE TYPE "public"."enum_submissions_status" AS ENUM('new', 'accepted', 'rejected', 'spam');
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'submissionDigest' BEFORE 'extractCandidates';
  ALTER TYPE "public"."enum_payload_jobs_log_parent_task_slug" ADD VALUE 'submissionDigest' BEFORE 'extractCandidates';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'submissionDigest' BEFORE 'extractCandidates';
  CREATE TABLE "submissions" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"claim_id" uuid NOT NULL,
  	"kind" "enum_submissions_kind" NOT NULL,
  	"text" varchar NOT NULL,
  	"location" varchar,
  	"evidence_url" varchar,
  	"name" varchar,
  	"contact" varchar,
  	"consent" boolean DEFAULT false,
  	"reference" varchar,
  	"status" "enum_submissions_status" DEFAULT 'new' NOT NULL,
  	"note" varchar,
  	"update_id" uuid,
  	"moderator_id" uuid,
  	"language" varchar,
  	"address_hash" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "submissions_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"submission_files_id" uuid,
  	"users_id" uuid
  );
  
  CREATE TABLE "submission_files" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
  
  CREATE TABLE "submission_files_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" uuid
  );
  
  CREATE TABLE "newsletter_signups" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"email" varchar NOT NULL,
  	"language" varchar,
  	"confirmed" boolean DEFAULT false,
  	"confirmed_at" timestamp(3) with time zone,
  	"token_hash" varchar,
  	"token_expires_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "newsletter_signups_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" uuid
  );
  
  ALTER TABLE "claim_updates" ADD COLUMN "submission_id" uuid;
  ALTER TABLE "_claim_updates_v" ADD COLUMN "version_submission_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "submissions_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "submission_files_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "newsletter_signups_id" uuid;
  ALTER TABLE "submissions" ADD CONSTRAINT "submissions_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "submissions" ADD CONSTRAINT "submissions_update_id_claim_updates_id_fk" FOREIGN KEY ("update_id") REFERENCES "public"."claim_updates"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "submissions" ADD CONSTRAINT "submissions_moderator_id_users_id_fk" FOREIGN KEY ("moderator_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "submissions_rels" ADD CONSTRAINT "submissions_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "submissions_rels" ADD CONSTRAINT "submissions_rels_submission_files_fk" FOREIGN KEY ("submission_files_id") REFERENCES "public"."submission_files"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "submissions_rels" ADD CONSTRAINT "submissions_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "submission_files_rels" ADD CONSTRAINT "submission_files_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."submission_files"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "submission_files_rels" ADD CONSTRAINT "submission_files_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "newsletter_signups_rels" ADD CONSTRAINT "newsletter_signups_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."newsletter_signups"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "newsletter_signups_rels" ADD CONSTRAINT "newsletter_signups_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "submissions_claim_idx" ON "submissions" USING btree ("claim_id");
  CREATE UNIQUE INDEX "submissions_reference_idx" ON "submissions" USING btree ("reference");
  CREATE INDEX "submissions_status_idx" ON "submissions" USING btree ("status");
  CREATE INDEX "submissions_update_idx" ON "submissions" USING btree ("update_id");
  CREATE INDEX "submissions_moderator_idx" ON "submissions" USING btree ("moderator_id");
  CREATE INDEX "submissions_address_hash_idx" ON "submissions" USING btree ("address_hash");
  CREATE INDEX "submissions_updated_at_idx" ON "submissions" USING btree ("updated_at");
  CREATE INDEX "submissions_created_at_idx" ON "submissions" USING btree ("created_at");
  CREATE INDEX "status_createdAt_idx" ON "submissions" USING btree ("status","created_at");
  CREATE INDEX "submissions_rels_order_idx" ON "submissions_rels" USING btree ("order");
  CREATE INDEX "submissions_rels_parent_idx" ON "submissions_rels" USING btree ("parent_id");
  CREATE INDEX "submissions_rels_path_idx" ON "submissions_rels" USING btree ("path");
  CREATE INDEX "submissions_rels_submission_files_id_idx" ON "submissions_rels" USING btree ("submission_files_id");
  CREATE INDEX "submissions_rels_users_id_idx" ON "submissions_rels" USING btree ("users_id");
  CREATE INDEX "submission_files_updated_at_idx" ON "submission_files" USING btree ("updated_at");
  CREATE INDEX "submission_files_created_at_idx" ON "submission_files" USING btree ("created_at");
  CREATE UNIQUE INDEX "submission_files_filename_idx" ON "submission_files" USING btree ("filename");
  CREATE INDEX "submission_files_original_original_filename_idx" ON "submission_files" USING btree ("original_filename");
  CREATE INDEX "submission_files_rels_order_idx" ON "submission_files_rels" USING btree ("order");
  CREATE INDEX "submission_files_rels_parent_idx" ON "submission_files_rels" USING btree ("parent_id");
  CREATE INDEX "submission_files_rels_path_idx" ON "submission_files_rels" USING btree ("path");
  CREATE INDEX "submission_files_rels_users_id_idx" ON "submission_files_rels" USING btree ("users_id");
  CREATE UNIQUE INDEX "newsletter_signups_email_idx" ON "newsletter_signups" USING btree ("email");
  CREATE INDEX "newsletter_signups_confirmed_idx" ON "newsletter_signups" USING btree ("confirmed");
  CREATE INDEX "newsletter_signups_token_hash_idx" ON "newsletter_signups" USING btree ("token_hash");
  CREATE INDEX "newsletter_signups_updated_at_idx" ON "newsletter_signups" USING btree ("updated_at");
  CREATE INDEX "newsletter_signups_created_at_idx" ON "newsletter_signups" USING btree ("created_at");
  CREATE INDEX "newsletter_signups_rels_order_idx" ON "newsletter_signups_rels" USING btree ("order");
  CREATE INDEX "newsletter_signups_rels_parent_idx" ON "newsletter_signups_rels" USING btree ("parent_id");
  CREATE INDEX "newsletter_signups_rels_path_idx" ON "newsletter_signups_rels" USING btree ("path");
  CREATE INDEX "newsletter_signups_rels_users_id_idx" ON "newsletter_signups_rels" USING btree ("users_id");
  ALTER TABLE "claim_updates" ADD CONSTRAINT "claim_updates_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_claim_updates_v" ADD CONSTRAINT "_claim_updates_v_version_submission_id_submissions_id_fk" FOREIGN KEY ("version_submission_id") REFERENCES "public"."submissions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_submissions_fk" FOREIGN KEY ("submissions_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_submission_files_fk" FOREIGN KEY ("submission_files_id") REFERENCES "public"."submission_files"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_newsletter_signups_fk" FOREIGN KEY ("newsletter_signups_id") REFERENCES "public"."newsletter_signups"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "claim_updates_submission_idx" ON "claim_updates" USING btree ("submission_id");
  CREATE INDEX "_claim_updates_v_version_version_submission_idx" ON "_claim_updates_v" USING btree ("version_submission_id");
  CREATE INDEX "payload_locked_documents_rels_submissions_id_idx" ON "payload_locked_documents_rels" USING btree ("submissions_id");
  CREATE INDEX "payload_locked_documents_rels_submission_files_id_idx" ON "payload_locked_documents_rels" USING btree ("submission_files_id");
  CREATE INDEX "payload_locked_documents_rels_newsletter_signups_id_idx" ON "payload_locked_documents_rels" USING btree ("newsletter_signups_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   -- Jobs for the task this removes go first: the old enum types do not have its name.
  DELETE FROM "payload_jobs_log" WHERE "task_slug"::text = 'submissionDigest' OR "parent_task_slug"::text = 'submissionDigest';
  DELETE FROM "payload_jobs" WHERE "task_slug"::text = 'submissionDigest';
   ALTER TABLE "submissions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "submissions_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "submission_files" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "submission_files_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "newsletter_signups" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "newsletter_signups_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "submissions" CASCADE;
  DROP TABLE "submissions_rels" CASCADE;
  DROP TABLE "submission_files" CASCADE;
  DROP TABLE "submission_files_rels" CASCADE;
  DROP TABLE "newsletter_signups" CASCADE;
  DROP TABLE "newsletter_signups_rels" CASCADE;
  ALTER TABLE "claim_updates" DROP CONSTRAINT IF EXISTS "claim_updates_submission_id_submissions_id_fk";
  
  ALTER TABLE "_claim_updates_v" DROP CONSTRAINT IF EXISTS "_claim_updates_v_version_submission_id_submissions_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_submissions_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_submission_files_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_newsletter_signups_fk";
  
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'runImport', 'fetchDocument', 'extractText', 'cleanupJobs', 'cascadePublishing', 'recomputePublishing', 'dailyPublishing', 'refreshCounts', 'extractCandidates');
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_log_task_slug" USING "task_slug"::"public"."enum_payload_jobs_log_task_slug";
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "parent_task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_log_parent_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_log_parent_task_slug" AS ENUM('inline', 'runImport', 'fetchDocument', 'extractText', 'cleanupJobs', 'cascadePublishing', 'recomputePublishing', 'dailyPublishing', 'refreshCounts', 'extractCandidates');
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "parent_task_slug" SET DATA TYPE "public"."enum_payload_jobs_log_parent_task_slug" USING "parent_task_slug"::"public"."enum_payload_jobs_log_parent_task_slug";
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'runImport', 'fetchDocument', 'extractText', 'cleanupJobs', 'cascadePublishing', 'recomputePublishing', 'dailyPublishing', 'refreshCounts', 'extractCandidates');
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_task_slug" USING "task_slug"::"public"."enum_payload_jobs_task_slug";
  DROP INDEX "claim_updates_submission_idx";
  DROP INDEX "_claim_updates_v_version_version_submission_idx";
  DROP INDEX "payload_locked_documents_rels_submissions_id_idx";
  DROP INDEX "payload_locked_documents_rels_submission_files_id_idx";
  DROP INDEX "payload_locked_documents_rels_newsletter_signups_id_idx";
  ALTER TABLE "claim_updates" DROP COLUMN "submission_id";
  ALTER TABLE "_claim_updates_v" DROP COLUMN "version_submission_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "submissions_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "submission_files_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "newsletter_signups_id";
  DROP TYPE "public"."enum_submissions_kind";
  DROP TYPE "public"."enum_submissions_status";`)
}
