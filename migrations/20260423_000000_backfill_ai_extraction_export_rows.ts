import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-mongodb";
import {
  AI_EXTRACTION_EXPORT_ROWS_COLLECTION,
  rebuildAllAIExtractionExportRows,
} from "../src/lib/aiExtractionExportRows";

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await rebuildAllAIExtractionExportRows({ payload });
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  await payload.delete({
    collection: AI_EXTRACTION_EXPORT_ROWS_COLLECTION,
    overrideAccess: true,
    where: {},
  });
}
