import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_claim_updates_kind" AS ENUM('first-rating', 'change', 'correction');
  CREATE TYPE "public"."enum_claim_updates_record_status" AS ENUM('ready', 'hold', 'archived');
  CREATE TYPE "public"."enum_claim_updates_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__claim_updates_v_version_kind" AS ENUM('first-rating', 'change', 'correction');
  CREATE TYPE "public"."enum__claim_updates_v_version_record_status" AS ENUM('ready', 'hold', 'archived');
  CREATE TYPE "public"."enum__claim_updates_v_published_locale" AS ENUM('en', 'fr', 'pt', 'ar', 'sw');
  CREATE TYPE "public"."enum__claim_updates_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_evidence_kind" AS ENUM('document', 'dataset', 'social-post', 'article');
  CREATE TYPE "public"."enum__evidence_v_version_kind" AS ENUM('document', 'dataset', 'social-post', 'article');
  CREATE TYPE "public"."enum_rating_reviews_outcome" AS ENUM('confirmed', 'changed', 'updated');
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'claim';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'date';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'rating';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'narrative';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'narrative:fr';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'narrative:pt';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'narrative:ar';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'narrative:sw';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'attribution';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'evidenceLink';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'evidenceTitle';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'evidenceKind';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'evidencePublisher';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'evidenceDate';
  ALTER TYPE "public"."enum_imports_mapping_field" ADD VALUE 'evidenceFinding';
  ALTER TYPE "public"."enum_imports_record_type" ADD VALUE 'claim-updates';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'claim';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'date';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'rating';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'narrative';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'narrative:fr';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'narrative:pt';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'narrative:ar';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'narrative:sw';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'attribution';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'evidenceLink';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'evidenceTitle';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'evidenceKind';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'evidencePublisher';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'evidenceDate';
  ALTER TYPE "public"."enum__imports_v_version_mapping_field" ADD VALUE 'evidenceFinding';
  ALTER TYPE "public"."enum__imports_v_version_record_type" ADD VALUE 'claim-updates';
  ALTER TYPE "public"."enum_import_mappings_record_type" ADD VALUE 'claim-updates';
  ALTER TYPE "public"."enum__import_mappings_v_version_record_type" ADD VALUE 'claim-updates';
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'refreshCounts';
  ALTER TYPE "public"."enum_payload_jobs_log_parent_task_slug" ADD VALUE 'refreshCounts';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'refreshCounts';
  CREATE TABLE "claim_updates" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"claim_id" uuid,
  	"date" varchar,
  	"rating" varchar,
  	"kind" "enum_claim_updates_kind",
  	"attribution" varchar,
  	"country_id" uuid,
  	"record_status" "enum_claim_updates_record_status" DEFAULT 'hold',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "claim_updates_locales" (
  	"title" varchar,
  	"narrative" varchar,
  	"_status" "enum_claim_updates_status" DEFAULT 'draft',
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" uuid NOT NULL
  );
  
  CREATE TABLE "claim_updates_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "claim_updates_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"evidence_id" uuid,
  	"users_id" uuid
  );
  
  CREATE TABLE "_claim_updates_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"parent_id" uuid,
  	"version_claim_id" uuid,
  	"version_date" varchar,
  	"version_rating" varchar,
  	"version_kind" "enum__claim_updates_v_version_kind",
  	"version_attribution" varchar,
  	"version_country_id" uuid,
  	"version_record_status" "enum__claim_updates_v_version_record_status" DEFAULT 'hold',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version_deleted_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"published_locale" "enum__claim_updates_v_published_locale",
  	"latest" boolean
  );
  
  CREATE TABLE "_claim_updates_v_locales" (
  	"version_title" varchar,
  	"version_narrative" varchar,
  	"version__status" "enum__claim_updates_v_version_status" DEFAULT 'draft',
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" uuid NOT NULL
  );
  
  CREATE TABLE "_claim_updates_v_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "_claim_updates_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"evidence_id" uuid,
  	"users_id" uuid
  );
  
  CREATE TABLE "evidence" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"title" varchar NOT NULL,
  	"kind" "enum_evidence_kind" DEFAULT 'document' NOT NULL,
  	"publisher" varchar,
  	"date" varchar,
  	"link" varchar,
  	"file_id" uuid,
  	"thumbnail_id" uuid,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "evidence_locales" (
  	"finding" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" uuid NOT NULL
  );
  
  CREATE TABLE "evidence_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" uuid
  );
  
  CREATE TABLE "_evidence_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"parent_id" uuid,
  	"version_title" varchar NOT NULL,
  	"version_kind" "enum__evidence_v_version_kind" DEFAULT 'document' NOT NULL,
  	"version_publisher" varchar,
  	"version_date" varchar,
  	"version_link" varchar,
  	"version_file_id" uuid,
  	"version_thumbnail_id" uuid,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version_deleted_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_evidence_v_locales" (
  	"version_finding" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" uuid NOT NULL
  );
  
  CREATE TABLE "_evidence_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" uuid
  );
  
  CREATE TABLE "rating_reviews" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"claim_id" uuid NOT NULL,
  	"outcome" "enum_rating_reviews_outcome" NOT NULL,
  	"rating" varchar,
  	"reviewer_id" uuid,
  	"date" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "rating_reviews_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" uuid
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "claim_updates_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "evidence_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "rating_reviews_id" uuid;
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
  ALTER TABLE "claim_updates" ADD CONSTRAINT "claim_updates_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "claim_updates" ADD CONSTRAINT "claim_updates_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "claim_updates_locales" ADD CONSTRAINT "claim_updates_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."claim_updates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "claim_updates_texts" ADD CONSTRAINT "claim_updates_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."claim_updates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "claim_updates_rels" ADD CONSTRAINT "claim_updates_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."claim_updates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "claim_updates_rels" ADD CONSTRAINT "claim_updates_rels_evidence_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "claim_updates_rels" ADD CONSTRAINT "claim_updates_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_claim_updates_v" ADD CONSTRAINT "_claim_updates_v_parent_id_claim_updates_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."claim_updates"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_claim_updates_v" ADD CONSTRAINT "_claim_updates_v_version_claim_id_claims_id_fk" FOREIGN KEY ("version_claim_id") REFERENCES "public"."claims"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_claim_updates_v" ADD CONSTRAINT "_claim_updates_v_version_country_id_countries_id_fk" FOREIGN KEY ("version_country_id") REFERENCES "public"."countries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_claim_updates_v_locales" ADD CONSTRAINT "_claim_updates_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_claim_updates_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_claim_updates_v_texts" ADD CONSTRAINT "_claim_updates_v_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_claim_updates_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_claim_updates_v_rels" ADD CONSTRAINT "_claim_updates_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_claim_updates_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_claim_updates_v_rels" ADD CONSTRAINT "_claim_updates_v_rels_evidence_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_claim_updates_v_rels" ADD CONSTRAINT "_claim_updates_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "evidence" ADD CONSTRAINT "evidence_file_id_media_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "evidence" ADD CONSTRAINT "evidence_thumbnail_id_media_id_fk" FOREIGN KEY ("thumbnail_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "evidence_locales" ADD CONSTRAINT "evidence_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."evidence"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "evidence_rels" ADD CONSTRAINT "evidence_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."evidence"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "evidence_rels" ADD CONSTRAINT "evidence_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_evidence_v" ADD CONSTRAINT "_evidence_v_parent_id_evidence_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."evidence"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_evidence_v" ADD CONSTRAINT "_evidence_v_version_file_id_media_id_fk" FOREIGN KEY ("version_file_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_evidence_v" ADD CONSTRAINT "_evidence_v_version_thumbnail_id_media_id_fk" FOREIGN KEY ("version_thumbnail_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_evidence_v_locales" ADD CONSTRAINT "_evidence_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_evidence_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_evidence_v_rels" ADD CONSTRAINT "_evidence_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_evidence_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_evidence_v_rels" ADD CONSTRAINT "_evidence_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "rating_reviews" ADD CONSTRAINT "rating_reviews_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "rating_reviews" ADD CONSTRAINT "rating_reviews_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "rating_reviews_rels" ADD CONSTRAINT "rating_reviews_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."rating_reviews"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "rating_reviews_rels" ADD CONSTRAINT "rating_reviews_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "claim_updates_claim_idx" ON "claim_updates" USING btree ("claim_id");
  CREATE INDEX "claim_updates_date_idx" ON "claim_updates" USING btree ("date");
  CREATE INDEX "claim_updates_rating_idx" ON "claim_updates" USING btree ("rating");
  CREATE INDEX "claim_updates_country_idx" ON "claim_updates" USING btree ("country_id");
  CREATE INDEX "claim_updates_record_status_idx" ON "claim_updates" USING btree ("record_status");
  CREATE INDEX "claim_updates_updated_at_idx" ON "claim_updates" USING btree ("updated_at");
  CREATE INDEX "claim_updates_created_at_idx" ON "claim_updates" USING btree ("created_at");
  CREATE INDEX "claim_updates_deleted_at_idx" ON "claim_updates" USING btree ("deleted_at");
  CREATE INDEX "claim_updates__status_idx" ON "claim_updates_locales" USING btree ("_status","_locale");
  CREATE UNIQUE INDEX "claim_updates_locales_parent_id_locale_unique" ON "claim_updates_locales" USING btree ("_parent_id","_locale");
  CREATE INDEX "claim_updates_texts_order_parent" ON "claim_updates_texts" USING btree ("order","parent_id");
  CREATE INDEX "claim_updates_texts_text_idx" ON "claim_updates_texts" USING btree ("text");
  CREATE INDEX "claim_updates_rels_order_idx" ON "claim_updates_rels" USING btree ("order");
  CREATE INDEX "claim_updates_rels_parent_idx" ON "claim_updates_rels" USING btree ("parent_id");
  CREATE INDEX "claim_updates_rels_path_idx" ON "claim_updates_rels" USING btree ("path");
  CREATE INDEX "claim_updates_rels_evidence_id_idx" ON "claim_updates_rels" USING btree ("evidence_id");
  CREATE INDEX "claim_updates_rels_users_id_idx" ON "claim_updates_rels" USING btree ("users_id");
  CREATE INDEX "_claim_updates_v_parent_idx" ON "_claim_updates_v" USING btree ("parent_id");
  CREATE INDEX "_claim_updates_v_version_version_claim_idx" ON "_claim_updates_v" USING btree ("version_claim_id");
  CREATE INDEX "_claim_updates_v_version_version_date_idx" ON "_claim_updates_v" USING btree ("version_date");
  CREATE INDEX "_claim_updates_v_version_version_rating_idx" ON "_claim_updates_v" USING btree ("version_rating");
  CREATE INDEX "_claim_updates_v_version_version_country_idx" ON "_claim_updates_v" USING btree ("version_country_id");
  CREATE INDEX "_claim_updates_v_version_version_record_status_idx" ON "_claim_updates_v" USING btree ("version_record_status");
  CREATE INDEX "_claim_updates_v_version_version_updated_at_idx" ON "_claim_updates_v" USING btree ("version_updated_at");
  CREATE INDEX "_claim_updates_v_version_version_created_at_idx" ON "_claim_updates_v" USING btree ("version_created_at");
  CREATE INDEX "_claim_updates_v_version_version_deleted_at_idx" ON "_claim_updates_v" USING btree ("version_deleted_at");
  CREATE INDEX "_claim_updates_v_created_at_idx" ON "_claim_updates_v" USING btree ("created_at");
  CREATE INDEX "_claim_updates_v_updated_at_idx" ON "_claim_updates_v" USING btree ("updated_at");
  CREATE INDEX "_claim_updates_v_published_locale_idx" ON "_claim_updates_v" USING btree ("published_locale");
  CREATE INDEX "_claim_updates_v_latest_idx" ON "_claim_updates_v" USING btree ("latest");
  CREATE INDEX "_claim_updates_v_version_version__status_idx" ON "_claim_updates_v_locales" USING btree ("version__status","_locale");
  CREATE UNIQUE INDEX "_claim_updates_v_locales_parent_id_locale_unique" ON "_claim_updates_v_locales" USING btree ("_parent_id","_locale");
  CREATE INDEX "_claim_updates_v_texts_order_parent" ON "_claim_updates_v_texts" USING btree ("order","parent_id");
  CREATE INDEX "_claim_updates_v_rels_order_idx" ON "_claim_updates_v_rels" USING btree ("order");
  CREATE INDEX "_claim_updates_v_rels_parent_idx" ON "_claim_updates_v_rels" USING btree ("parent_id");
  CREATE INDEX "_claim_updates_v_rels_path_idx" ON "_claim_updates_v_rels" USING btree ("path");
  CREATE INDEX "_claim_updates_v_rels_evidence_id_idx" ON "_claim_updates_v_rels" USING btree ("evidence_id");
  CREATE INDEX "_claim_updates_v_rels_users_id_idx" ON "_claim_updates_v_rels" USING btree ("users_id");
  CREATE INDEX "evidence_date_idx" ON "evidence" USING btree ("date");
  CREATE INDEX "evidence_link_idx" ON "evidence" USING btree ("link");
  CREATE INDEX "evidence_file_idx" ON "evidence" USING btree ("file_id");
  CREATE INDEX "evidence_thumbnail_idx" ON "evidence" USING btree ("thumbnail_id");
  CREATE INDEX "evidence_updated_at_idx" ON "evidence" USING btree ("updated_at");
  CREATE INDEX "evidence_created_at_idx" ON "evidence" USING btree ("created_at");
  CREATE INDEX "evidence_deleted_at_idx" ON "evidence" USING btree ("deleted_at");
  CREATE UNIQUE INDEX "evidence_locales_parent_id_locale_unique" ON "evidence_locales" USING btree ("_parent_id","_locale");
  CREATE INDEX "evidence_rels_order_idx" ON "evidence_rels" USING btree ("order");
  CREATE INDEX "evidence_rels_parent_idx" ON "evidence_rels" USING btree ("parent_id");
  CREATE INDEX "evidence_rels_path_idx" ON "evidence_rels" USING btree ("path");
  CREATE INDEX "evidence_rels_users_id_idx" ON "evidence_rels" USING btree ("users_id");
  CREATE INDEX "_evidence_v_parent_idx" ON "_evidence_v" USING btree ("parent_id");
  CREATE INDEX "_evidence_v_version_version_date_idx" ON "_evidence_v" USING btree ("version_date");
  CREATE INDEX "_evidence_v_version_version_link_idx" ON "_evidence_v" USING btree ("version_link");
  CREATE INDEX "_evidence_v_version_version_file_idx" ON "_evidence_v" USING btree ("version_file_id");
  CREATE INDEX "_evidence_v_version_version_thumbnail_idx" ON "_evidence_v" USING btree ("version_thumbnail_id");
  CREATE INDEX "_evidence_v_version_version_updated_at_idx" ON "_evidence_v" USING btree ("version_updated_at");
  CREATE INDEX "_evidence_v_version_version_created_at_idx" ON "_evidence_v" USING btree ("version_created_at");
  CREATE INDEX "_evidence_v_version_version_deleted_at_idx" ON "_evidence_v" USING btree ("version_deleted_at");
  CREATE INDEX "_evidence_v_created_at_idx" ON "_evidence_v" USING btree ("created_at");
  CREATE INDEX "_evidence_v_updated_at_idx" ON "_evidence_v" USING btree ("updated_at");
  CREATE UNIQUE INDEX "_evidence_v_locales_parent_id_locale_unique" ON "_evidence_v_locales" USING btree ("_parent_id","_locale");
  CREATE INDEX "_evidence_v_rels_order_idx" ON "_evidence_v_rels" USING btree ("order");
  CREATE INDEX "_evidence_v_rels_parent_idx" ON "_evidence_v_rels" USING btree ("parent_id");
  CREATE INDEX "_evidence_v_rels_path_idx" ON "_evidence_v_rels" USING btree ("path");
  CREATE INDEX "_evidence_v_rels_users_id_idx" ON "_evidence_v_rels" USING btree ("users_id");
  CREATE INDEX "rating_reviews_claim_idx" ON "rating_reviews" USING btree ("claim_id");
  CREATE INDEX "rating_reviews_reviewer_idx" ON "rating_reviews" USING btree ("reviewer_id");
  CREATE INDEX "rating_reviews_date_idx" ON "rating_reviews" USING btree ("date");
  CREATE INDEX "rating_reviews_updated_at_idx" ON "rating_reviews" USING btree ("updated_at");
  CREATE INDEX "rating_reviews_created_at_idx" ON "rating_reviews" USING btree ("created_at");
  CREATE INDEX "rating_reviews_rels_order_idx" ON "rating_reviews_rels" USING btree ("order");
  CREATE INDEX "rating_reviews_rels_parent_idx" ON "rating_reviews_rels" USING btree ("parent_id");
  CREATE INDEX "rating_reviews_rels_path_idx" ON "rating_reviews_rels" USING btree ("path");
  CREATE INDEX "rating_reviews_rels_users_id_idx" ON "rating_reviews_rels" USING btree ("users_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_claim_updates_fk" FOREIGN KEY ("claim_updates_id") REFERENCES "public"."claim_updates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_evidence_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_rating_reviews_fk" FOREIGN KEY ("rating_reviews_id") REFERENCES "public"."rating_reviews"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_claim_updates_id_idx" ON "payload_locked_documents_rels" USING btree ("claim_updates_id");
  CREATE INDEX "payload_locked_documents_rels_evidence_id_idx" ON "payload_locked_documents_rels" USING btree ("evidence_id");
  CREATE INDEX "payload_locked_documents_rels_rating_reviews_id_idx" ON "payload_locked_documents_rels" USING btree ("rating_reviews_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DELETE FROM "payload_jobs_log" WHERE "task_slug"::text = 'refreshCounts' OR "parent_task_slug"::text = 'refreshCounts';
  DELETE FROM "payload_jobs" WHERE "task_slug"::text = 'refreshCounts';
  DELETE FROM "imports" WHERE "record_type"::text = 'claim-updates';
  DELETE FROM "_imports_v" WHERE "version_record_type"::text = 'claim-updates';
  DELETE FROM "import_mappings" WHERE "record_type"::text = 'claim-updates';
  DELETE FROM "_import_mappings_v" WHERE "version_record_type"::text = 'claim-updates';
  DELETE FROM "imports_mapping" WHERE "field"::text ~ '^(claim|date|rating|narrative|attribution|evidence[A-Za-z]+)(:|$)';
  DELETE FROM "_imports_v_version_mapping" WHERE "field"::text ~ '^(claim|date|rating|narrative|attribution|evidence[A-Za-z]+)(:|$)';
   ALTER TABLE "claim_updates" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "claim_updates_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "claim_updates_texts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "claim_updates_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_claim_updates_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_claim_updates_v_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_claim_updates_v_texts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_claim_updates_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "evidence" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "evidence_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "evidence_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_evidence_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_evidence_v_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_evidence_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "rating_reviews" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "rating_reviews_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE IF EXISTS "claim_updates" CASCADE;
  DROP TABLE IF EXISTS "claim_updates_locales" CASCADE;
  DROP TABLE IF EXISTS "claim_updates_texts" CASCADE;
  DROP TABLE IF EXISTS "claim_updates_rels" CASCADE;
  DROP TABLE IF EXISTS "_claim_updates_v" CASCADE;
  DROP TABLE IF EXISTS "_claim_updates_v_locales" CASCADE;
  DROP TABLE IF EXISTS "_claim_updates_v_texts" CASCADE;
  DROP TABLE IF EXISTS "_claim_updates_v_rels" CASCADE;
  DROP TABLE IF EXISTS "evidence" CASCADE;
  DROP TABLE IF EXISTS "evidence_locales" CASCADE;
  DROP TABLE IF EXISTS "evidence_rels" CASCADE;
  DROP TABLE IF EXISTS "_evidence_v" CASCADE;
  DROP TABLE IF EXISTS "_evidence_v_locales" CASCADE;
  DROP TABLE IF EXISTS "_evidence_v_rels" CASCADE;
  DROP TABLE IF EXISTS "rating_reviews" CASCADE;
  DROP TABLE IF EXISTS "rating_reviews_rels" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_claim_updates_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_evidence_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_rating_reviews_fk";
  
  ALTER TABLE "imports_mapping" ALTER COLUMN "field" SET DATA TYPE text;
  DROP TYPE "public"."enum_imports_mapping_field";
  CREATE TYPE "public"."enum_imports_mapping_field" AS ENUM('name', 'name:fr', 'name:pt', 'name:ar', 'name:sw', 'slug', 'type', 'parent', 'page', 'externalCode', 'shortName', 'shortName:fr', 'shortName:pt', 'shortName:ar', 'shortName:sw', 'areaType', 'holdersPerSeat', 'order', 'kind', 'honorific', 'gender', 'institutionType', 'imageCredit', 'biography', 'biography:fr', 'biography:pt', 'biography:ar', 'biography:sw', 'actor', 'office', 'area', 'party', 'electedOn', 'startsOn', 'endsOn', 'successor', 'closingSummary', 'closingSummary:fr', 'closingSummary:pt', 'closingSummary:ar', 'closingSummary:sw', 'title', 'title:fr', 'title:pt', 'title:ar', 'title:sw', 'topic', 'statement', 'summary', 'summary:fr', 'summary:pt', 'summary:ar', 'summary:sw', 'saidAt', 'saidOn', 'deadline', 'deadlineText', 'deadlineText:fr', 'deadlineText:pt', 'deadlineText:ar', 'deadlineText:sw', 'sourceUrl', 'sourceLocator', 'verdict', 'rationale', 'rationale:fr', 'rationale:pt', 'rationale:ar', 'rationale:sw');
  ALTER TABLE "imports_mapping" ALTER COLUMN "field" SET DATA TYPE "public"."enum_imports_mapping_field" USING "field"::"public"."enum_imports_mapping_field";
  ALTER TABLE "imports" ALTER COLUMN "record_type" SET DATA TYPE text;
  DROP TYPE "public"."enum_imports_record_type";
  CREATE TYPE "public"."enum_imports_record_type" AS ENUM('areas', 'offices', 'actors', 'terms', 'claims');
  ALTER TABLE "imports" ALTER COLUMN "record_type" SET DATA TYPE "public"."enum_imports_record_type" USING "record_type"::"public"."enum_imports_record_type";
  ALTER TABLE "_imports_v_version_mapping" ALTER COLUMN "field" SET DATA TYPE text;
  DROP TYPE "public"."enum__imports_v_version_mapping_field";
  CREATE TYPE "public"."enum__imports_v_version_mapping_field" AS ENUM('name', 'name:fr', 'name:pt', 'name:ar', 'name:sw', 'slug', 'type', 'parent', 'page', 'externalCode', 'shortName', 'shortName:fr', 'shortName:pt', 'shortName:ar', 'shortName:sw', 'areaType', 'holdersPerSeat', 'order', 'kind', 'honorific', 'gender', 'institutionType', 'imageCredit', 'biography', 'biography:fr', 'biography:pt', 'biography:ar', 'biography:sw', 'actor', 'office', 'area', 'party', 'electedOn', 'startsOn', 'endsOn', 'successor', 'closingSummary', 'closingSummary:fr', 'closingSummary:pt', 'closingSummary:ar', 'closingSummary:sw', 'title', 'title:fr', 'title:pt', 'title:ar', 'title:sw', 'topic', 'statement', 'summary', 'summary:fr', 'summary:pt', 'summary:ar', 'summary:sw', 'saidAt', 'saidOn', 'deadline', 'deadlineText', 'deadlineText:fr', 'deadlineText:pt', 'deadlineText:ar', 'deadlineText:sw', 'sourceUrl', 'sourceLocator', 'verdict', 'rationale', 'rationale:fr', 'rationale:pt', 'rationale:ar', 'rationale:sw');
  ALTER TABLE "_imports_v_version_mapping" ALTER COLUMN "field" SET DATA TYPE "public"."enum__imports_v_version_mapping_field" USING "field"::"public"."enum__imports_v_version_mapping_field";
  ALTER TABLE "_imports_v" ALTER COLUMN "version_record_type" SET DATA TYPE text;
  DROP TYPE "public"."enum__imports_v_version_record_type";
  CREATE TYPE "public"."enum__imports_v_version_record_type" AS ENUM('areas', 'offices', 'actors', 'terms', 'claims');
  ALTER TABLE "_imports_v" ALTER COLUMN "version_record_type" SET DATA TYPE "public"."enum__imports_v_version_record_type" USING "version_record_type"::"public"."enum__imports_v_version_record_type";
  ALTER TABLE "import_mappings" ALTER COLUMN "record_type" SET DATA TYPE text;
  DROP TYPE "public"."enum_import_mappings_record_type";
  CREATE TYPE "public"."enum_import_mappings_record_type" AS ENUM('areas', 'offices', 'actors', 'terms', 'claims');
  ALTER TABLE "import_mappings" ALTER COLUMN "record_type" SET DATA TYPE "public"."enum_import_mappings_record_type" USING "record_type"::"public"."enum_import_mappings_record_type";
  ALTER TABLE "_import_mappings_v" ALTER COLUMN "version_record_type" SET DATA TYPE text;
  DROP TYPE "public"."enum__import_mappings_v_version_record_type";
  CREATE TYPE "public"."enum__import_mappings_v_version_record_type" AS ENUM('areas', 'offices', 'actors', 'terms', 'claims');
  ALTER TABLE "_import_mappings_v" ALTER COLUMN "version_record_type" SET DATA TYPE "public"."enum__import_mappings_v_version_record_type" USING "version_record_type"::"public"."enum__import_mappings_v_version_record_type";
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'runImport', 'fetchDocument', 'extractText', 'cleanupJobs', 'cascadePublishing', 'recomputePublishing', 'dailyPublishing');
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_log_task_slug" USING "task_slug"::"public"."enum_payload_jobs_log_task_slug";
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "parent_task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_log_parent_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_log_parent_task_slug" AS ENUM('inline', 'runImport', 'fetchDocument', 'extractText', 'cleanupJobs', 'cascadePublishing', 'recomputePublishing', 'dailyPublishing');
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "parent_task_slug" SET DATA TYPE "public"."enum_payload_jobs_log_parent_task_slug" USING "parent_task_slug"::"public"."enum_payload_jobs_log_parent_task_slug";
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'runImport', 'fetchDocument', 'extractText', 'cleanupJobs', 'cascadePublishing', 'recomputePublishing', 'dailyPublishing');
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_task_slug" USING "task_slug"::"public"."enum_payload_jobs_task_slug";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_claim_updates_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_evidence_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_rating_reviews_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "claim_updates_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "evidence_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "rating_reviews_id";
  ALTER TABLE "site_locales" DROP COLUMN IF EXISTS "strings_last_reviewed";
  ALTER TABLE "site_locales" DROP COLUMN IF EXISTS "strings_timeline_title";
  ALTER TABLE "site_locales" DROP COLUMN IF EXISTS "strings_history_title";
  ALTER TABLE "site_locales" DROP COLUMN IF EXISTS "strings_full_history";
  ALTER TABLE "site_locales" DROP COLUMN IF EXISTS "strings_back_to_claim";
  ALTER TABLE "site_locales" DROP COLUMN IF EXISTS "strings_correction";
  ALTER TABLE "site_locales" DROP COLUMN IF EXISTS "strings_evidence_title";
  ALTER TABLE "site_locales" DROP COLUMN IF EXISTS "strings_latest_changes";
  ALTER TABLE "site_locales" DROP COLUMN IF EXISTS "strings_reported_by";
  ALTER TABLE "site_locales" DROP COLUMN IF EXISTS "strings_copy_citation";
  ALTER TABLE "site_locales" DROP COLUMN IF EXISTS "strings_citation_copied";
  ALTER TABLE "site_locales" DROP COLUMN IF EXISTS "strings_cite_as";
  ALTER TABLE "site_locales" DROP COLUMN IF EXISTS "strings_cite_as_unreviewed";
  ALTER TABLE "_site_v_locales" DROP COLUMN IF EXISTS "version_strings_last_reviewed";
  ALTER TABLE "_site_v_locales" DROP COLUMN IF EXISTS "version_strings_timeline_title";
  ALTER TABLE "_site_v_locales" DROP COLUMN IF EXISTS "version_strings_history_title";
  ALTER TABLE "_site_v_locales" DROP COLUMN IF EXISTS "version_strings_full_history";
  ALTER TABLE "_site_v_locales" DROP COLUMN IF EXISTS "version_strings_back_to_claim";
  ALTER TABLE "_site_v_locales" DROP COLUMN IF EXISTS "version_strings_correction";
  ALTER TABLE "_site_v_locales" DROP COLUMN IF EXISTS "version_strings_evidence_title";
  ALTER TABLE "_site_v_locales" DROP COLUMN IF EXISTS "version_strings_latest_changes";
  ALTER TABLE "_site_v_locales" DROP COLUMN IF EXISTS "version_strings_reported_by";
  ALTER TABLE "_site_v_locales" DROP COLUMN IF EXISTS "version_strings_copy_citation";
  ALTER TABLE "_site_v_locales" DROP COLUMN IF EXISTS "version_strings_citation_copied";
  ALTER TABLE "_site_v_locales" DROP COLUMN IF EXISTS "version_strings_cite_as";
  ALTER TABLE "_site_v_locales" DROP COLUMN IF EXISTS "version_strings_cite_as_unreviewed";
  DROP TYPE "public"."enum_claim_updates_kind";
  DROP TYPE "public"."enum_claim_updates_record_status";
  DROP TYPE "public"."enum_claim_updates_status";
  DROP TYPE "public"."enum__claim_updates_v_version_kind";
  DROP TYPE "public"."enum__claim_updates_v_version_record_status";
  DROP TYPE "public"."enum__claim_updates_v_published_locale";
  DROP TYPE "public"."enum__claim_updates_v_version_status";
  DROP TYPE "public"."enum_evidence_kind";
  DROP TYPE "public"."enum__evidence_v_version_kind";
  DROP TYPE "public"."enum_rating_reviews_outcome";`)
}
