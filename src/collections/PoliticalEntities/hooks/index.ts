import { deleteAIExtractionExportRowsForPoliticalEntity } from "@/lib/aiExtractionExportRows";
import { queueAIExtractionExportRowsSync } from "@/lib/aiExtractionExportRowsJobs";
import type { PoliticalEntity } from "@/payload-types";
import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
} from "payload";

export const queueAIExtractionExportRowsSyncAfterPoliticalEntityChange: CollectionAfterChangeHook<
  PoliticalEntity
> = async ({ doc, req }) => {
  await queueAIExtractionExportRowsSync({
    errorMessage:
      "Failed to queue AI extraction export row sync after political entity change",
    input: {
      politicalEntityId: String(doc.id),
      scope: "politicalEntity",
    },
    logContext: {
      politicalEntityId: String(doc.id),
    },
    req,
  });

  return doc;
};

export const deleteAIExtractionExportRowsAfterPoliticalEntityDelete: CollectionAfterDeleteHook<
  PoliticalEntity
> = async ({ doc, req }) => {
  try {
    await deleteAIExtractionExportRowsForPoliticalEntity({
      payload: req.payload,
      politicalEntityId: String(doc.id),
      req,
    });
  } catch (err) {
    req.payload.logger.error({
      err,
      msg: "Failed to delete AI extraction export rows after political entity delete",
      politicalEntityId: String(doc.id),
    });
  }

  return doc;
};
