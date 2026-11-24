import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'
import { recomputeAll } from '@promisetracker/plugin-core'
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_claims_verification_verdict" AS ENUM('unverified', 'verified', 'false', 'misleading');
  CREATE TYPE "public"."enum__claims_v_version_verification_verdict" AS ENUM('unverified', 'verified', 'false', 'misleading');
  CREATE TYPE "public"."enum_payload_query_presets_access_read_constraint" AS ENUM('everyone', 'onlyMe', 'specificUsers');
  CREATE TYPE "public"."enum_payload_query_presets_access_update_constraint" AS ENUM('everyone', 'onlyMe', 'specificUsers');
  CREATE TYPE "public"."enum_payload_query_presets_access_delete_constraint" AS ENUM('everyone', 'onlyMe', 'specificUsers');
  CREATE TYPE "public"."enum_payload_query_presets_related_collection" AS ENUM('claims');
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'verdict';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'rationale';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'rationale:fr';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'rationale:pt';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'rationale:ar';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'rationale:sw';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'verdict';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'rationale';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'rationale:fr';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'rationale:pt';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'rationale:ar';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'rationale:sw';
  CREATE TABLE "payload_query_presets" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"title" varchar NOT NULL,
  	"group_by" varchar,
  	"columns" jsonb,
  	"where" jsonb,
  	"is_shared" boolean DEFAULT false,
  	"access_read_constraint" "enum_payload_query_presets_access_read_constraint" DEFAULT 'onlyMe',
  	"access_update_constraint" "enum_payload_query_presets_access_update_constraint" DEFAULT 'onlyMe',
  	"access_delete_constraint" "enum_payload_query_presets_access_delete_constraint" DEFAULT 'onlyMe',
  	"related_collection" "enum_payload_query_presets_related_collection" NOT NULL,
  	"is_temp" boolean,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_query_presets_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" uuid
  );
  
  ALTER TABLE "claims" ADD COLUMN "verification_verdict" "enum_claims_verification_verdict" DEFAULT 'unverified';
  ALTER TABLE "claims" ADD COLUMN "verification_date" timestamp(3) with time zone;
  ALTER TABLE "claims" ADD COLUMN "verification_report_url" varchar;
  ALTER TABLE "claims" ADD COLUMN "verification_verified_by_id" uuid;
  ALTER TABLE "claims_locales" ADD COLUMN "verification_rationale" varchar;
  ALTER TABLE "_claims_v" ADD COLUMN "version_verification_verdict" "enum__claims_v_version_verification_verdict" DEFAULT 'unverified';
  ALTER TABLE "_claims_v" ADD COLUMN "version_verification_date" timestamp(3) with time zone;
  ALTER TABLE "_claims_v" ADD COLUMN "version_verification_report_url" varchar;
  ALTER TABLE "_claims_v" ADD COLUMN "version_verification_verified_by_id" uuid;
  ALTER TABLE "_claims_v_locales" ADD COLUMN "version_verification_rationale" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_verified_on" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_verified_title" varchar;
  ALTER TABLE "site_locales" ADD COLUMN "strings_verified_report" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_verified_on" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_verified_title" varchar;
  ALTER TABLE "_site_v_locales" ADD COLUMN "version_strings_verified_report" varchar;
  ALTER TABLE "payload_query_presets_rels" ADD CONSTRAINT "payload_query_presets_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_query_presets"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_query_presets_rels" ADD CONSTRAINT "payload_query_presets_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_query_presets_updated_at_idx" ON "payload_query_presets" USING btree ("updated_at");
  CREATE INDEX "payload_query_presets_created_at_idx" ON "payload_query_presets" USING btree ("created_at");
  CREATE INDEX "payload_query_presets_rels_order_idx" ON "payload_query_presets_rels" USING btree ("order");
  CREATE INDEX "payload_query_presets_rels_parent_idx" ON "payload_query_presets_rels" USING btree ("parent_id");
  CREATE INDEX "payload_query_presets_rels_path_idx" ON "payload_query_presets_rels" USING btree ("path");
  CREATE INDEX "payload_query_presets_rels_users_id_idx" ON "payload_query_presets_rels" USING btree ("users_id");
  ALTER TABLE "claims" ADD CONSTRAINT "claims_verification_verified_by_id_users_id_fk" FOREIGN KEY ("verification_verified_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_claims_v" ADD CONSTRAINT "_claims_v_version_verification_verified_by_id_users_id_fk" FOREIGN KEY ("version_verification_verified_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "claims_verification_verification_verdict_idx" ON "claims" USING btree ("verification_verdict");
  CREATE INDEX "claims_verification_verification_verified_by_idx" ON "claims" USING btree ("verification_verified_by_id");
  CREATE INDEX "_claims_v_version_verification_version_verification_verd_idx" ON "_claims_v" USING btree ("version_verification_verdict");
  CREATE INDEX "_claims_v_version_verification_version_verification_veri_idx" ON "_claims_v" USING btree ("version_verification_verified_by_id");`)
  // Claims saved before verification have no verdict, so none is published
  // until a reviewer verifies it (section 5.1). Their status is worked out again.
  await recomputeAll(payload, ['claims'], req)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   -- Mapping rows that use the verdict columns go first: the old types do not have those values.
  DELETE FROM "imports_mapping" WHERE "field"::text ~ '^(verdict|rationale)(:|$)';
  DELETE FROM "_imports_v_version_mapping" WHERE "field"::text ~ '^(verdict|rationale)(:|$)';
   ALTER TABLE "payload_query_presets" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_query_presets_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "payload_query_presets" CASCADE;
  DROP TABLE "payload_query_presets_rels" CASCADE;
  ALTER TABLE "claims" DROP CONSTRAINT IF EXISTS "claims_verification_verified_by_id_users_id_fk";
  
  ALTER TABLE "_claims_v" DROP CONSTRAINT IF EXISTS "_claims_v_version_verification_verified_by_id_users_id_fk";
  
  ALTER TABLE "imports_mapping" ALTER COLUMN "field" SET DATA TYPE text;
  DROP TYPE "public"."enum_imports_mapping_field";
  CREATE TYPE "public"."enum_imports_mapping_field" AS ENUM('name', 'name:fr', 'name:pt', 'name:ar', 'name:sw', 'slug', 'type', 'parent', 'page', 'externalCode', 'shortName', 'shortName:fr', 'shortName:pt', 'shortName:ar', 'shortName:sw', 'areaType', 'holdersPerSeat', 'order', 'kind', 'honorific', 'gender', 'institutionType', 'imageCredit', 'biography', 'biography:fr', 'biography:pt', 'biography:ar', 'biography:sw', 'actor', 'office', 'area', 'party', 'electedOn', 'startsOn', 'endsOn', 'successor', 'closingSummary', 'closingSummary:fr', 'closingSummary:pt', 'closingSummary:ar', 'closingSummary:sw', 'title', 'title:fr', 'title:pt', 'title:ar', 'title:sw', 'topic', 'statement', 'summary', 'summary:fr', 'summary:pt', 'summary:ar', 'summary:sw', 'saidAt', 'saidOn', 'deadline', 'deadlineText', 'deadlineText:fr', 'deadlineText:pt', 'deadlineText:ar', 'deadlineText:sw', 'sourceUrl', 'sourceLocator');
  ALTER TABLE "imports_mapping" ALTER COLUMN "field" SET DATA TYPE "public"."enum_imports_mapping_field" USING "field"::"public"."enum_imports_mapping_field";
  ALTER TABLE "_imports_v_version_mapping" ALTER COLUMN "field" SET DATA TYPE text;
  DROP TYPE "public"."enum__imports_v_version_mapping_field";
  CREATE TYPE "public"."enum__imports_v_version_mapping_field" AS ENUM('name', 'name:fr', 'name:pt', 'name:ar', 'name:sw', 'slug', 'type', 'parent', 'page', 'externalCode', 'shortName', 'shortName:fr', 'shortName:pt', 'shortName:ar', 'shortName:sw', 'areaType', 'holdersPerSeat', 'order', 'kind', 'honorific', 'gender', 'institutionType', 'imageCredit', 'biography', 'biography:fr', 'biography:pt', 'biography:ar', 'biography:sw', 'actor', 'office', 'area', 'party', 'electedOn', 'startsOn', 'endsOn', 'successor', 'closingSummary', 'closingSummary:fr', 'closingSummary:pt', 'closingSummary:ar', 'closingSummary:sw', 'title', 'title:fr', 'title:pt', 'title:ar', 'title:sw', 'topic', 'statement', 'summary', 'summary:fr', 'summary:pt', 'summary:ar', 'summary:sw', 'saidAt', 'saidOn', 'deadline', 'deadlineText', 'deadlineText:fr', 'deadlineText:pt', 'deadlineText:ar', 'deadlineText:sw', 'sourceUrl', 'sourceLocator');
  ALTER TABLE "_imports_v_version_mapping" ALTER COLUMN "field" SET DATA TYPE "public"."enum__imports_v_version_mapping_field" USING "field"::"public"."enum__imports_v_version_mapping_field";
  DROP INDEX IF EXISTS "claims_verification_verification_verdict_idx";
  DROP INDEX IF EXISTS "claims_verification_verification_verified_by_idx";
  DROP INDEX IF EXISTS "_claims_v_version_verification_version_verification_verd_idx";
  DROP INDEX IF EXISTS "_claims_v_version_verification_version_verification_veri_idx";
  ALTER TABLE "claims" DROP COLUMN "verification_verdict";
  ALTER TABLE "claims" DROP COLUMN "verification_date";
  ALTER TABLE "claims" DROP COLUMN "verification_report_url";
  ALTER TABLE "claims" DROP COLUMN "verification_verified_by_id";
  ALTER TABLE "claims_locales" DROP COLUMN "verification_rationale";
  ALTER TABLE "_claims_v" DROP COLUMN "version_verification_verdict";
  ALTER TABLE "_claims_v" DROP COLUMN "version_verification_date";
  ALTER TABLE "_claims_v" DROP COLUMN "version_verification_report_url";
  ALTER TABLE "_claims_v" DROP COLUMN "version_verification_verified_by_id";
  ALTER TABLE "_claims_v_locales" DROP COLUMN "version_verification_rationale";
  ALTER TABLE "site_locales" DROP COLUMN "strings_verified_on";
  ALTER TABLE "site_locales" DROP COLUMN "strings_verified_title";
  ALTER TABLE "site_locales" DROP COLUMN "strings_verified_report";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_verified_on";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_verified_title";
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_verified_report";
  DROP TYPE "public"."enum_claims_verification_verdict";
  DROP TYPE "public"."enum__claims_v_version_verification_verdict";
  DROP TYPE "public"."enum_payload_query_presets_access_read_constraint";
  DROP TYPE "public"."enum_payload_query_presets_access_update_constraint";
  DROP TYPE "public"."enum_payload_query_presets_access_delete_constraint";
  DROP TYPE "public"."enum_payload_query_presets_related_collection";`)
}
