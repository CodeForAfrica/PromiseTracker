import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'
import { recomputeAll } from '@promisetracker/plugin-core'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_actors_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__actors_v_published_locale" AS ENUM('en', 'fr', 'pt', 'ar', 'sw');
  CREATE TYPE "public"."enum__actors_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_countries_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__countries_v_published_locale" AS ENUM('en', 'fr', 'pt', 'ar', 'sw');
  CREATE TYPE "public"."enum__countries_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_documents_record_status" AS ENUM('ready', 'hold', 'archived');
  CREATE TYPE "public"."enum__documents_v_version_record_status" AS ENUM('ready', 'hold', 'archived');
  CREATE TYPE "public"."enum_claims_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__claims_v_published_locale" AS ENUM('en', 'fr', 'pt', 'ar', 'sw');
  CREATE TYPE "public"."enum__claims_v_version_status" AS ENUM('draft', 'published');
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'cascadePublishing';
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'recomputePublishing';
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'dailyPublishing';
  ALTER TYPE "public"."enum_payload_jobs_log_parent_task_slug" ADD VALUE 'cascadePublishing';
  ALTER TYPE "public"."enum_payload_jobs_log_parent_task_slug" ADD VALUE 'recomputePublishing';
  ALTER TYPE "public"."enum_payload_jobs_log_parent_task_slug" ADD VALUE 'dailyPublishing';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'cascadePublishing';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'recomputePublishing';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'dailyPublishing';
  CREATE TABLE "documents_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "_documents_v_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  ALTER TABLE "actors_links" ALTER COLUMN "type" DROP NOT NULL;
  ALTER TABLE "actors_links" ALTER COLUMN "url" DROP NOT NULL;
  ALTER TABLE "actors" ALTER COLUMN "name" DROP NOT NULL;
  ALTER TABLE "actors" ALTER COLUMN "kind" DROP NOT NULL;
  ALTER TABLE "actors" ALTER COLUMN "country_id" DROP NOT NULL;
  ALTER TABLE "actors" ALTER COLUMN "record_status" DROP NOT NULL;
  ALTER TABLE "_actors_v_version_links" ALTER COLUMN "type" DROP NOT NULL;
  ALTER TABLE "_actors_v_version_links" ALTER COLUMN "url" DROP NOT NULL;
  ALTER TABLE "_actors_v" ALTER COLUMN "version_name" DROP NOT NULL;
  ALTER TABLE "_actors_v" ALTER COLUMN "version_kind" DROP NOT NULL;
  ALTER TABLE "_actors_v" ALTER COLUMN "version_country_id" DROP NOT NULL;
  ALTER TABLE "_actors_v" ALTER COLUMN "version_record_status" DROP NOT NULL;
  ALTER TABLE "countries" ALTER COLUMN "code" DROP NOT NULL;
  ALTER TABLE "countries" ALTER COLUMN "record_status" DROP NOT NULL;
  ALTER TABLE "_countries_v" ALTER COLUMN "version_code" DROP NOT NULL;
  ALTER TABLE "_countries_v" ALTER COLUMN "version_record_status" DROP NOT NULL;
  ALTER TABLE "claims" ALTER COLUMN "actor_id" DROP NOT NULL;
  ALTER TABLE "claims" ALTER COLUMN "record_status" DROP NOT NULL;
  ALTER TABLE "claims_locales" ALTER COLUMN "title" DROP NOT NULL;
  ALTER TABLE "_claims_v" ALTER COLUMN "version_actor_id" DROP NOT NULL;
  ALTER TABLE "_claims_v" ALTER COLUMN "version_record_status" DROP NOT NULL;
  ALTER TABLE "_claims_v_locales" ALTER COLUMN "version_title" DROP NOT NULL;
  ALTER TABLE "actors" ADD COLUMN "publishing_problems" varchar;
  ALTER TABLE "actors" ADD COLUMN "deleted_at" timestamp(3) with time zone;
  ALTER TABLE "actors_locales" ADD COLUMN "_status" "enum_actors_status" DEFAULT 'draft';
  ALTER TABLE "_actors_v" ADD COLUMN "version_publishing_problems" varchar;
  ALTER TABLE "_actors_v" ADD COLUMN "version_deleted_at" timestamp(3) with time zone;
  ALTER TABLE "_actors_v" ADD COLUMN "published_locale" "enum__actors_v_published_locale";
  ALTER TABLE "_actors_v" ADD COLUMN "latest" boolean;
  ALTER TABLE "_actors_v_locales" ADD COLUMN "version__status" "enum__actors_v_version_status" DEFAULT 'draft';
  ALTER TABLE "terms" ADD COLUMN "deleted_at" timestamp(3) with time zone;
  ALTER TABLE "_terms_v" ADD COLUMN "version_deleted_at" timestamp(3) with time zone;
  ALTER TABLE "countries" ADD COLUMN "deleted_at" timestamp(3) with time zone;
  ALTER TABLE "countries_locales" ADD COLUMN "_status" "enum_countries_status" DEFAULT 'draft';
  ALTER TABLE "_countries_v" ADD COLUMN "version_deleted_at" timestamp(3) with time zone;
  ALTER TABLE "_countries_v" ADD COLUMN "published_locale" "enum__countries_v_published_locale";
  ALTER TABLE "_countries_v" ADD COLUMN "latest" boolean;
  ALTER TABLE "_countries_v_locales" ADD COLUMN "version__status" "enum__countries_v_version_status" DEFAULT 'draft';
  ALTER TABLE "areas" ADD COLUMN "deleted_at" timestamp(3) with time zone;
  ALTER TABLE "_areas_v" ADD COLUMN "version_deleted_at" timestamp(3) with time zone;
  ALTER TABLE "offices" ADD COLUMN "deleted_at" timestamp(3) with time zone;
  ALTER TABLE "_offices_v" ADD COLUMN "version_deleted_at" timestamp(3) with time zone;
  ALTER TABLE "documents" ADD COLUMN "record_status" "enum_documents_record_status" DEFAULT 'ready' NOT NULL;
  ALTER TABLE "documents" ADD COLUMN "deleted_at" timestamp(3) with time zone;
  ALTER TABLE "_documents_v" ADD COLUMN "version_record_status" "enum__documents_v_version_record_status" DEFAULT 'ready' NOT NULL;
  ALTER TABLE "_documents_v" ADD COLUMN "version_deleted_at" timestamp(3) with time zone;
  ALTER TABLE "claims" ADD COLUMN "source_id" uuid;
  ALTER TABLE "claims" ADD COLUMN "publishing_problems" varchar;
  ALTER TABLE "claims" ADD COLUMN "deleted_at" timestamp(3) with time zone;
  ALTER TABLE "claims_locales" ADD COLUMN "_status" "enum_claims_status" DEFAULT 'draft';
  ALTER TABLE "_claims_v" ADD COLUMN "version_source_id" uuid;
  ALTER TABLE "_claims_v" ADD COLUMN "version_publishing_problems" varchar;
  ALTER TABLE "_claims_v" ADD COLUMN "version_deleted_at" timestamp(3) with time zone;
  ALTER TABLE "_claims_v" ADD COLUMN "published_locale" "enum__claims_v_published_locale";
  ALTER TABLE "_claims_v" ADD COLUMN "latest" boolean;
  ALTER TABLE "_claims_v_locales" ADD COLUMN "version__status" "enum__claims_v_version_status" DEFAULT 'draft';
  ALTER TABLE "topics" ADD COLUMN "deleted_at" timestamp(3) with time zone;
  ALTER TABLE "_topics_v" ADD COLUMN "version_deleted_at" timestamp(3) with time zone;
  ALTER TABLE "documents_texts" ADD CONSTRAINT "documents_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_documents_v_texts" ADD CONSTRAINT "_documents_v_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_documents_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "documents_texts_order_parent" ON "documents_texts" USING btree ("order","parent_id");
  CREATE INDEX "documents_texts_text_idx" ON "documents_texts" USING btree ("text");
  CREATE INDEX "_documents_v_texts_order_parent" ON "_documents_v_texts" USING btree ("order","parent_id");
  ALTER TABLE "claims" ADD CONSTRAINT "claims_source_id_documents_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_claims_v" ADD CONSTRAINT "_claims_v_version_source_id_documents_id_fk" FOREIGN KEY ("version_source_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "actors_deleted_at_idx" ON "actors" USING btree ("deleted_at");
  CREATE INDEX "actors__status_idx" ON "actors_locales" USING btree ("_status","_locale");
  CREATE INDEX "_actors_v_version_version_deleted_at_idx" ON "_actors_v" USING btree ("version_deleted_at");
  CREATE INDEX "_actors_v_published_locale_idx" ON "_actors_v" USING btree ("published_locale");
  CREATE INDEX "_actors_v_latest_idx" ON "_actors_v" USING btree ("latest");
  CREATE INDEX "_actors_v_version_version__status_idx" ON "_actors_v_locales" USING btree ("version__status","_locale");
  CREATE INDEX "terms_deleted_at_idx" ON "terms" USING btree ("deleted_at");
  CREATE INDEX "_terms_v_version_version_deleted_at_idx" ON "_terms_v" USING btree ("version_deleted_at");
  CREATE INDEX "countries_deleted_at_idx" ON "countries" USING btree ("deleted_at");
  CREATE INDEX "countries__status_idx" ON "countries_locales" USING btree ("_status","_locale");
  CREATE INDEX "_countries_v_version_version_deleted_at_idx" ON "_countries_v" USING btree ("version_deleted_at");
  CREATE INDEX "_countries_v_published_locale_idx" ON "_countries_v" USING btree ("published_locale");
  CREATE INDEX "_countries_v_latest_idx" ON "_countries_v" USING btree ("latest");
  CREATE INDEX "_countries_v_version_version__status_idx" ON "_countries_v_locales" USING btree ("version__status","_locale");
  CREATE INDEX "areas_deleted_at_idx" ON "areas" USING btree ("deleted_at");
  CREATE INDEX "areas_texts_text_idx" ON "areas_texts" USING btree ("text");
  CREATE INDEX "_areas_v_version_version_deleted_at_idx" ON "_areas_v" USING btree ("version_deleted_at");
  CREATE INDEX "offices_deleted_at_idx" ON "offices" USING btree ("deleted_at");
  CREATE INDEX "_offices_v_version_version_deleted_at_idx" ON "_offices_v" USING btree ("version_deleted_at");
  CREATE INDEX "documents_record_status_idx" ON "documents" USING btree ("record_status");
  CREATE INDEX "documents_deleted_at_idx" ON "documents" USING btree ("deleted_at");
  CREATE INDEX "_documents_v_version_version_record_status_idx" ON "_documents_v" USING btree ("version_record_status");
  CREATE INDEX "_documents_v_version_version_deleted_at_idx" ON "_documents_v" USING btree ("version_deleted_at");
  CREATE INDEX "claims_source_idx" ON "claims" USING btree ("source_id");
  CREATE INDEX "claims_deleted_at_idx" ON "claims" USING btree ("deleted_at");
  CREATE INDEX "claims__status_idx" ON "claims_locales" USING btree ("_status","_locale");
  CREATE INDEX "_claims_v_version_version_source_idx" ON "_claims_v" USING btree ("version_source_id");
  CREATE INDEX "_claims_v_version_version_deleted_at_idx" ON "_claims_v" USING btree ("version_deleted_at");
  CREATE INDEX "_claims_v_published_locale_idx" ON "_claims_v" USING btree ("published_locale");
  CREATE INDEX "_claims_v_latest_idx" ON "_claims_v" USING btree ("latest");
  CREATE INDEX "_claims_v_version_version__status_idx" ON "_claims_v_locales" USING btree ("version__status","_locale");
  CREATE INDEX "topics_deleted_at_idx" ON "topics" USING btree ("deleted_at");
  CREATE INDEX "_topics_v_version_version_deleted_at_idx" ON "_topics_v" USING btree ("version_deleted_at");`)
  // Records saved before drafts were live in every language they had a value
  // in. Each is marked published in those languages, so nothing public goes
  // dark. Actors have no required text, so they are published in every
  // language. Then every record's published status is worked out again.
  for (const table of ['countries', 'actors', 'claims'] as const) {
    await db.execute(sql.raw(`UPDATE "${table}_locales" SET "_status" = 'published'`))
  }
  await db.execute(sql`
    INSERT INTO "actors_locales" ("_parent_id", "_locale", "_status")
    SELECT a.id, l.code::"_locales", 'published'
    FROM "actors" a CROSS JOIN (VALUES ('en'), ('fr'), ('pt'), ('ar'), ('sw')) AS l(code)
    ON CONFLICT ("_parent_id", "_locale") DO UPDATE SET "_status" = 'published'
  `)
  // Each record's newest version becomes its latest, published one, which is
  // what the admin opens once drafts are on.
  for (const table of ['countries', 'actors', 'claims'] as const) {
    await db.execute(
      sql.raw(`
        UPDATE "_${table}_v" v SET "latest" = true
        FROM (
          SELECT DISTINCT ON ("parent_id") "id" FROM "_${table}_v"
          ORDER BY "parent_id", "updated_at" DESC, "created_at" DESC
        ) newest
        WHERE v."id" = newest."id"
      `),
    )
    await db.execute(sql.raw(`UPDATE "_${table}_v_locales" SET "version__status" = 'published'`))
  }
  await db.execute(sql`
    INSERT INTO "_actors_v_locales" ("_parent_id", "_locale", "version__status")
    SELECT v.id, l.code::"_locales", 'published'
    FROM "_actors_v" v CROSS JOIN (VALUES ('en'), ('fr'), ('pt'), ('ar'), ('sw')) AS l(code)
    WHERE v."latest"
    ON CONFLICT ("_parent_id", "_locale") DO UPDATE SET "version__status" = 'published'
  `)
  await recomputeAll(payload, undefined, req)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "documents_texts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_documents_v_texts" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "documents_texts" CASCADE;
  DROP TABLE "_documents_v_texts" CASCADE;
  ALTER TABLE "claims" DROP CONSTRAINT IF EXISTS "claims_source_id_documents_id_fk";
  
  ALTER TABLE "_claims_v" DROP CONSTRAINT IF EXISTS "_claims_v_version_source_id_documents_id_fk";
  
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'runImport', 'fetchDocument', 'extractText', 'cleanupJobs');
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_log_task_slug" USING "task_slug"::"public"."enum_payload_jobs_log_task_slug";
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "parent_task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_log_parent_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_log_parent_task_slug" AS ENUM('inline', 'runImport', 'fetchDocument', 'extractText', 'cleanupJobs');
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "parent_task_slug" SET DATA TYPE "public"."enum_payload_jobs_log_parent_task_slug" USING "parent_task_slug"::"public"."enum_payload_jobs_log_parent_task_slug";
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'runImport', 'fetchDocument', 'extractText', 'cleanupJobs');
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_task_slug" USING "task_slug"::"public"."enum_payload_jobs_task_slug";
  DROP INDEX IF EXISTS "actors_deleted_at_idx";
  DROP INDEX IF EXISTS "actors__status_idx";
  DROP INDEX IF EXISTS "_actors_v_version_version_deleted_at_idx";
  DROP INDEX IF EXISTS "_actors_v_published_locale_idx";
  DROP INDEX IF EXISTS "_actors_v_latest_idx";
  DROP INDEX IF EXISTS "_actors_v_version_version__status_idx";
  DROP INDEX IF EXISTS "terms_deleted_at_idx";
  DROP INDEX IF EXISTS "_terms_v_version_version_deleted_at_idx";
  DROP INDEX IF EXISTS "countries_deleted_at_idx";
  DROP INDEX IF EXISTS "countries__status_idx";
  DROP INDEX IF EXISTS "_countries_v_version_version_deleted_at_idx";
  DROP INDEX IF EXISTS "_countries_v_published_locale_idx";
  DROP INDEX IF EXISTS "_countries_v_latest_idx";
  DROP INDEX IF EXISTS "_countries_v_version_version__status_idx";
  DROP INDEX IF EXISTS "areas_deleted_at_idx";
  DROP INDEX IF EXISTS "areas_texts_text_idx";
  DROP INDEX IF EXISTS "_areas_v_version_version_deleted_at_idx";
  DROP INDEX IF EXISTS "offices_deleted_at_idx";
  DROP INDEX IF EXISTS "_offices_v_version_version_deleted_at_idx";
  DROP INDEX IF EXISTS "documents_record_status_idx";
  DROP INDEX IF EXISTS "documents_deleted_at_idx";
  DROP INDEX IF EXISTS "_documents_v_version_version_record_status_idx";
  DROP INDEX IF EXISTS "_documents_v_version_version_deleted_at_idx";
  DROP INDEX IF EXISTS "claims_source_idx";
  DROP INDEX IF EXISTS "claims_deleted_at_idx";
  DROP INDEX IF EXISTS "claims__status_idx";
  DROP INDEX IF EXISTS "_claims_v_version_version_source_idx";
  DROP INDEX IF EXISTS "_claims_v_version_version_deleted_at_idx";
  DROP INDEX IF EXISTS "_claims_v_published_locale_idx";
  DROP INDEX IF EXISTS "_claims_v_latest_idx";
  DROP INDEX IF EXISTS "_claims_v_version_version__status_idx";
  DROP INDEX IF EXISTS "topics_deleted_at_idx";
  DROP INDEX IF EXISTS "_topics_v_version_version_deleted_at_idx";
  ALTER TABLE "actors_links" ALTER COLUMN "type" SET NOT NULL;
  ALTER TABLE "actors_links" ALTER COLUMN "url" SET NOT NULL;
  ALTER TABLE "actors" ALTER COLUMN "name" SET NOT NULL;
  ALTER TABLE "actors" ALTER COLUMN "kind" SET NOT NULL;
  ALTER TABLE "actors" ALTER COLUMN "country_id" SET NOT NULL;
  ALTER TABLE "actors" ALTER COLUMN "record_status" SET NOT NULL;
  ALTER TABLE "_actors_v_version_links" ALTER COLUMN "type" SET NOT NULL;
  ALTER TABLE "_actors_v_version_links" ALTER COLUMN "url" SET NOT NULL;
  ALTER TABLE "_actors_v" ALTER COLUMN "version_name" SET NOT NULL;
  ALTER TABLE "_actors_v" ALTER COLUMN "version_kind" SET NOT NULL;
  ALTER TABLE "_actors_v" ALTER COLUMN "version_country_id" SET NOT NULL;
  ALTER TABLE "_actors_v" ALTER COLUMN "version_record_status" SET NOT NULL;
  ALTER TABLE "countries" ALTER COLUMN "code" SET NOT NULL;
  ALTER TABLE "countries" ALTER COLUMN "record_status" SET NOT NULL;
  ALTER TABLE "_countries_v" ALTER COLUMN "version_code" SET NOT NULL;
  ALTER TABLE "_countries_v" ALTER COLUMN "version_record_status" SET NOT NULL;
  ALTER TABLE "claims" ALTER COLUMN "actor_id" SET NOT NULL;
  ALTER TABLE "claims" ALTER COLUMN "record_status" SET NOT NULL;
  ALTER TABLE "claims_locales" ALTER COLUMN "title" SET NOT NULL;
  ALTER TABLE "_claims_v" ALTER COLUMN "version_actor_id" SET NOT NULL;
  ALTER TABLE "_claims_v" ALTER COLUMN "version_record_status" SET NOT NULL;
  ALTER TABLE "_claims_v_locales" ALTER COLUMN "version_title" SET NOT NULL;
  ALTER TABLE "actors" DROP COLUMN "publishing_problems";
  ALTER TABLE "actors" DROP COLUMN "deleted_at";
  ALTER TABLE "actors_locales" DROP COLUMN "_status";
  ALTER TABLE "_actors_v" DROP COLUMN "version_publishing_problems";
  ALTER TABLE "_actors_v" DROP COLUMN "version_deleted_at";
  ALTER TABLE "_actors_v" DROP COLUMN "published_locale";
  ALTER TABLE "_actors_v" DROP COLUMN "latest";
  ALTER TABLE "_actors_v_locales" DROP COLUMN "version__status";
  ALTER TABLE "terms" DROP COLUMN "deleted_at";
  ALTER TABLE "_terms_v" DROP COLUMN "version_deleted_at";
  ALTER TABLE "countries" DROP COLUMN "deleted_at";
  ALTER TABLE "countries_locales" DROP COLUMN "_status";
  ALTER TABLE "_countries_v" DROP COLUMN "version_deleted_at";
  ALTER TABLE "_countries_v" DROP COLUMN "published_locale";
  ALTER TABLE "_countries_v" DROP COLUMN "latest";
  ALTER TABLE "_countries_v_locales" DROP COLUMN "version__status";
  ALTER TABLE "areas" DROP COLUMN "deleted_at";
  ALTER TABLE "_areas_v" DROP COLUMN "version_deleted_at";
  ALTER TABLE "offices" DROP COLUMN "deleted_at";
  ALTER TABLE "_offices_v" DROP COLUMN "version_deleted_at";
  ALTER TABLE "documents" DROP COLUMN "record_status";
  ALTER TABLE "documents" DROP COLUMN "deleted_at";
  ALTER TABLE "_documents_v" DROP COLUMN "version_record_status";
  ALTER TABLE "_documents_v" DROP COLUMN "version_deleted_at";
  ALTER TABLE "claims" DROP COLUMN "source_id";
  ALTER TABLE "claims" DROP COLUMN "publishing_problems";
  ALTER TABLE "claims" DROP COLUMN "deleted_at";
  ALTER TABLE "claims_locales" DROP COLUMN "_status";
  ALTER TABLE "_claims_v" DROP COLUMN "version_source_id";
  ALTER TABLE "_claims_v" DROP COLUMN "version_publishing_problems";
  ALTER TABLE "_claims_v" DROP COLUMN "version_deleted_at";
  ALTER TABLE "_claims_v" DROP COLUMN "published_locale";
  ALTER TABLE "_claims_v" DROP COLUMN "latest";
  ALTER TABLE "_claims_v_locales" DROP COLUMN "version__status";
  ALTER TABLE "topics" DROP COLUMN "deleted_at";
  ALTER TABLE "_topics_v" DROP COLUMN "version_deleted_at";
  DROP TYPE "public"."enum_actors_status";
  DROP TYPE "public"."enum__actors_v_published_locale";
  DROP TYPE "public"."enum__actors_v_version_status";
  DROP TYPE "public"."enum_countries_status";
  DROP TYPE "public"."enum__countries_v_published_locale";
  DROP TYPE "public"."enum__countries_v_version_status";
  DROP TYPE "public"."enum_documents_record_status";
  DROP TYPE "public"."enum__documents_v_version_record_status";
  DROP TYPE "public"."enum_claims_status";
  DROP TYPE "public"."enum__claims_v_published_locale";
  DROP TYPE "public"."enum__claims_v_version_status";`)
}
