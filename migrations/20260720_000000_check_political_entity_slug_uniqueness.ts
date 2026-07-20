import type { MigrateUpArgs } from "@payloadcms/db-mongodb";

/**
 * Political-entity slugs must be unique per tenant (enforced going forward by
 * the `ensureUniqueSlug` beforeValidate hook). This migration verifies no
 * pre-existing duplicates violate that invariant; it fails loudly so an
 * operator resolves the conflicting slugs before deploying, since duplicate
 * slugs make public entity resolution ambiguous.
 */
export async function up({ payload }: MigrateUpArgs): Promise<void> {
  const { docs } = await payload.find({
    collection: "political-entities",
    pagination: false,
    depth: 0,
    overrideAccess: true,
  });

  const entitiesByKey = new Map<string, string[]>();

  for (const doc of docs) {
    if (!doc.slug) {
      continue;
    }
    const tenantId =
      typeof doc.tenant === "string"
        ? doc.tenant
        : (doc.tenant?.id ?? "no-tenant");
    const key = `${tenantId}:${doc.slug}`;
    const entries = entitiesByKey.get(key) ?? [];
    entries.push(`${doc.name ?? "unnamed"} (${doc.id})`);
    entitiesByKey.set(key, entries);
  }

  const duplicates = [...entitiesByKey.entries()].filter(
    ([, entries]) => entries.length > 1,
  );

  if (duplicates.length > 0) {
    const details = duplicates
      .map(
        ([key, entries]) =>
          `  ${key}: ${entries.join(", ")}`,
      )
      .join("\n");

    throw new Error(
      `Duplicate political-entity slugs detected (tenant:slug). ` +
        `Resolve these before migrating:\n${details}`,
    );
  }

  payload.logger.info(
    "check_political_entity_slug_uniqueness:: no duplicate slugs found",
  );
}

export async function down(): Promise<void> {
  // Verification-only migration; nothing to revert.
}
