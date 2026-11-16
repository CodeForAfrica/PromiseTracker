import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_roles" AS ENUM('super-admin', 'editor', 'contributor', 'reviewer', 'moderator', 'viewer');
  CREATE TYPE "public"."enum__users_v_version_roles" AS ENUM('super-admin', 'editor', 'contributor', 'reviewer', 'moderator', 'viewer');
  CREATE TABLE "users_roles" (
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"value" "enum_users_roles",
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL
  );
  
  CREATE TABLE "users_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "_users_v_version_roles" (
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"value" "enum__users_v_version_roles",
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL
  );
  
  CREATE TABLE "_users_v_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  ALTER TABLE "users_roles" ADD CONSTRAINT "users_roles_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_texts" ADD CONSTRAINT "users_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_users_v_version_roles" ADD CONSTRAINT "_users_v_version_roles_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_users_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_users_v_texts" ADD CONSTRAINT "_users_v_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_users_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_roles_order_idx" ON "users_roles" USING btree ("order");
  CREATE INDEX "users_roles_parent_idx" ON "users_roles" USING btree ("parent_id");
  CREATE INDEX "users_texts_order_parent" ON "users_texts" USING btree ("order","parent_id");
  CREATE INDEX "_users_v_version_roles_order_idx" ON "_users_v_version_roles" USING btree ("order");
  CREATE INDEX "_users_v_version_roles_parent_idx" ON "_users_v_version_roles" USING btree ("parent_id");
  CREATE INDEX "_users_v_texts_order_parent" ON "_users_v_texts" USING btree ("order","parent_id");`)
  // Before roles existed, every signed-in user could do everything. Users made
  // before this migration keep that as super-admins, so nobody is locked out.
  await db.execute(sql`
   INSERT INTO "users_roles" ("order", "parent_id", "value")
   SELECT 1, "id", 'super-admin' FROM "users";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_roles" CASCADE;
  DROP TABLE "users_texts" CASCADE;
  DROP TABLE "_users_v_version_roles" CASCADE;
  DROP TABLE "_users_v_texts" CASCADE;
  DROP TYPE "public"."enum_users_roles";
  DROP TYPE "public"."enum__users_v_version_roles";`)
}
