import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_search_kind" AS ENUM('area', 'actor', 'claim', 'topic');
  CREATE TABLE "search_log" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"query" varchar NOT NULL,
  	"locale" varchar NOT NULL,
  	"country" varchar,
  	"results" numeric NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "search" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"priority" numeric,
  	"kind" "enum_search_kind",
  	"country" varchar,
  	"url" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "search_locales" (
  	"title" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" uuid NOT NULL
  );
  
  CREATE TABLE "search_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"areas_id" uuid,
  	"actors_id" uuid,
  	"claims_id" uuid,
  	"topics_id" uuid
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "search_log_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "search_id" uuid;
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
  ALTER TABLE "search_locales" ADD CONSTRAINT "search_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."search"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "search_rels" ADD CONSTRAINT "search_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."search"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "search_rels" ADD CONSTRAINT "search_rels_areas_fk" FOREIGN KEY ("areas_id") REFERENCES "public"."areas"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "search_rels" ADD CONSTRAINT "search_rels_actors_fk" FOREIGN KEY ("actors_id") REFERENCES "public"."actors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "search_rels" ADD CONSTRAINT "search_rels_claims_fk" FOREIGN KEY ("claims_id") REFERENCES "public"."claims"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "search_rels" ADD CONSTRAINT "search_rels_topics_fk" FOREIGN KEY ("topics_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "search_log_locale_idx" ON "search_log" USING btree ("locale");
  CREATE INDEX "search_log_country_idx" ON "search_log" USING btree ("country");
  CREATE INDEX "search_log_results_idx" ON "search_log" USING btree ("results");
  CREATE INDEX "search_log_updated_at_idx" ON "search_log" USING btree ("updated_at");
  CREATE INDEX "search_log_created_at_idx" ON "search_log" USING btree ("created_at");
  CREATE INDEX "search_kind_idx" ON "search" USING btree ("kind");
  CREATE INDEX "search_country_idx" ON "search" USING btree ("country");
  CREATE INDEX "search_updated_at_idx" ON "search" USING btree ("updated_at");
  CREATE INDEX "search_created_at_idx" ON "search" USING btree ("created_at");
  CREATE UNIQUE INDEX "search_locales_parent_id_locale_unique" ON "search_locales" USING btree ("_parent_id","_locale");
  CREATE INDEX "search_rels_order_idx" ON "search_rels" USING btree ("order");
  CREATE INDEX "search_rels_parent_idx" ON "search_rels" USING btree ("parent_id");
  CREATE INDEX "search_rels_path_idx" ON "search_rels" USING btree ("path");
  CREATE INDEX "search_rels_areas_id_idx" ON "search_rels" USING btree ("areas_id");
  CREATE INDEX "search_rels_actors_id_idx" ON "search_rels" USING btree ("actors_id");
  CREATE INDEX "search_rels_claims_id_idx" ON "search_rels" USING btree ("claims_id");
  CREATE INDEX "search_rels_topics_id_idx" ON "search_rels" USING btree ("topics_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_search_log_fk" FOREIGN KEY ("search_log_id") REFERENCES "public"."search_log"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_search_fk" FOREIGN KEY ("search_id") REFERENCES "public"."search"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_search_log_id_idx" ON "payload_locked_documents_rels" USING btree ("search_log_id");
  CREATE INDEX "payload_locked_documents_rels_search_id_idx" ON "payload_locked_documents_rels" USING btree ("search_id");`)
  // Search matches titles without their accents and despite misspellings
  // (section 16.2). Postgres indexes only immutable functions, and unaccent
  // is not, because its dictionary could change. This wrapper names the
  // dictionary, which makes it safe to mark immutable. Queries call the same
  // wrapper, so they use the trigram index.
  await db.execute(sql`
  CREATE OR REPLACE FUNCTION pt_unaccent(text) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
    AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;
  CREATE INDEX "search_locales_title_trgm_idx" ON "search_locales"
    USING gin (pt_unaccent("title") gin_trgm_ops);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX IF EXISTS "search_locales_title_trgm_idx";
  DROP FUNCTION IF EXISTS pt_unaccent(text);
   ALTER TABLE "search_log" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "search" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "search_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "search_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "search_log" CASCADE;
  DROP TABLE "search" CASCADE;
  DROP TABLE "search_locales" CASCADE;
  DROP TABLE "search_rels" CASCADE;
  -- Dropping the tables above with CASCADE has already removed these two.
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_search_log_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_search_fk";
  
  DROP INDEX "payload_locked_documents_rels_search_log_id_idx";
  DROP INDEX "payload_locked_documents_rels_search_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "search_log_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "search_id";
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
  ALTER TABLE "_site_v_locales" DROP COLUMN "version_strings_search_topics";
  DROP TYPE "public"."enum_search_kind";`)
}
