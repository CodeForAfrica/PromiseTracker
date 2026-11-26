import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_claims_check_report_state" AS ENUM('published', 'paused');
  CREATE TYPE "public"."enum_claims_check_sync_result" AS ENUM('applied', 'unchanged');
  CREATE TYPE "public"."enum__claims_v_version_check_report_state" AS ENUM('published', 'paused');
  CREATE TYPE "public"."enum__claims_v_version_check_sync_result" AS ENUM('applied', 'unchanged');
  CREATE TYPE "public"."enum_settings_check_statuses_verdict" AS ENUM('verified', 'false', 'misleading', 'unverified');
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'submitForVerification' BEFORE 'extractCandidates';
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'pollCheck';
  ALTER TYPE "public"."enum_payload_jobs_log_parent_task_slug" ADD VALUE 'submitForVerification' BEFORE 'extractCandidates';
  ALTER TYPE "public"."enum_payload_jobs_log_parent_task_slug" ADD VALUE 'pollCheck';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'submitForVerification' BEFORE 'extractCandidates';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'pollCheck';
  CREATE TABLE "settings_check_statuses" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"status" varchar,
  	"verdict" "enum_settings_check_statuses_verdict"
  );
  
  ALTER TABLE "claims" ADD COLUMN "check_item_id" varchar;
  ALTER TABLE "claims" ADD COLUMN "check_item_url" varchar;
  ALTER TABLE "claims" ADD COLUMN "check_report_state" "enum_claims_check_report_state";
  ALTER TABLE "claims" ADD COLUMN "check_synced_at" timestamp(3) with time zone;
  ALTER TABLE "claims" ADD COLUMN "check_sync_result" "enum_claims_check_sync_result";
  ALTER TABLE "_claims_v" ADD COLUMN "version_check_item_id" varchar;
  ALTER TABLE "_claims_v" ADD COLUMN "version_check_item_url" varchar;
  ALTER TABLE "_claims_v" ADD COLUMN "version_check_report_state" "enum__claims_v_version_check_report_state";
  ALTER TABLE "_claims_v" ADD COLUMN "version_check_synced_at" timestamp(3) with time zone;
  ALTER TABLE "_claims_v" ADD COLUMN "version_check_sync_result" "enum__claims_v_version_check_sync_result";
  ALTER TABLE "settings" ADD COLUMN "check_workspace" varchar;
  ALTER TABLE "settings" ADD COLUMN "check_api_key" varchar;
  ALTER TABLE "settings" ADD COLUMN "check_webhook_secret" varchar;
  ALTER TABLE "settings_check_statuses" ADD CONSTRAINT "settings_check_statuses_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."settings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "settings_check_statuses_order_idx" ON "settings_check_statuses" USING btree ("_order");
  CREATE INDEX "settings_check_statuses_parent_id_idx" ON "settings_check_statuses" USING btree ("_parent_id");
  CREATE INDEX "claims_check_check_item_id_idx" ON "claims" USING btree ("check_item_id");
  CREATE INDEX "_claims_v_version_check_version_check_item_id_idx" ON "_claims_v" USING btree ("version_check_item_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DELETE FROM "payload_jobs_log" WHERE "task_slug"::text IN ('submitForVerification', 'pollCheck') OR "parent_task_slug"::text IN ('submitForVerification', 'pollCheck');
  DELETE FROM "payload_jobs" WHERE "task_slug"::text IN ('submitForVerification', 'pollCheck');
   ALTER TABLE "settings_check_statuses" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "settings_check_statuses" CASCADE;
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
  DROP INDEX IF EXISTS "claims_check_check_item_id_idx";
  DROP INDEX IF EXISTS "_claims_v_version_check_version_check_item_id_idx";
  ALTER TABLE "claims" DROP COLUMN "check_item_id";
  ALTER TABLE "claims" DROP COLUMN "check_item_url";
  ALTER TABLE "claims" DROP COLUMN "check_report_state";
  ALTER TABLE "claims" DROP COLUMN "check_synced_at";
  ALTER TABLE "claims" DROP COLUMN "check_sync_result";
  ALTER TABLE "_claims_v" DROP COLUMN "version_check_item_id";
  ALTER TABLE "_claims_v" DROP COLUMN "version_check_item_url";
  ALTER TABLE "_claims_v" DROP COLUMN "version_check_report_state";
  ALTER TABLE "_claims_v" DROP COLUMN "version_check_synced_at";
  ALTER TABLE "_claims_v" DROP COLUMN "version_check_sync_result";
  ALTER TABLE "settings" DROP COLUMN "check_workspace";
  ALTER TABLE "settings" DROP COLUMN "check_api_key";
  ALTER TABLE "settings" DROP COLUMN "check_webhook_secret";
  DROP TYPE "public"."enum_claims_check_report_state";
  DROP TYPE "public"."enum_claims_check_sync_result";
  DROP TYPE "public"."enum__claims_v_version_check_report_state";
  DROP TYPE "public"."enum__claims_v_version_check_sync_result";
  DROP TYPE "public"."enum_settings_check_statuses_verdict";`)
}
