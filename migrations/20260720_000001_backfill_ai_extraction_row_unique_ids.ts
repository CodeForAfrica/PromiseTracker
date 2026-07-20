import type { MigrateUpArgs } from "@payloadcms/db-mongodb";
import { assignMissingExtractionRowUniqueIds } from "../src/lib/aiExtractionUniqueIds";

/**
 * Every AI extraction row now requires a system-generated uniqueId so each
 * extraction can be matched to its downstream upload. This migration
 * backfills a uniqueId onto any pre-existing extraction rows missing one.
 */
export async function up({ payload }: MigrateUpArgs): Promise<void> {
  const batchSize = 100;
  let page = 1;
  let hasNextPage = true;
  let updated = 0;

  while (hasNextPage) {
    const result = await payload.find({
      collection: "ai-extractions",
      limit: batchSize,
      page,
      depth: 0,
      overrideAccess: true,
    });

    for (const doc of result.docs) {
      const backfilled = assignMissingExtractionRowUniqueIds(doc.extractions);
      if (!backfilled) {
        continue;
      }

      await payload.update({
        collection: "ai-extractions",
        id: doc.id,
        depth: 0,
        overrideAccess: true,
        data: {
          extractions:
            backfilled as unknown as (typeof doc)["extractions"],
        },
      });
      updated += 1;
    }

    hasNextPage = result.hasNextPage;
    page += 1;
  }

  payload.logger.info(
    `backfill_ai_extraction_row_unique_ids:: backfilled uniqueIds on ${updated} extraction record(s)`,
  );
}

export async function down(): Promise<void> {
  // Backfill only; generated IDs are harmless to keep.
}
