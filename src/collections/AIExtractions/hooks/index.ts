import { deleteAIExtractionExportRowsForAIExtraction } from "@/lib/aiExtractionExportRows";
import { queueAIExtractionExportRowsSync } from "@/lib/aiExtractionExportRowsJobs";
import type { AiExtraction } from "@/payload-types";
import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
} from "payload";

export const queueAIExtractionExportRowsSyncAfterAIExtractionChange: CollectionAfterChangeHook<
  AiExtraction
> = async ({ doc, req }) => {
  await queueAIExtractionExportRowsSync({
    errorMessage:
      "Failed to queue AI extraction export row sync after AI extraction change",
    input: {
      aiExtractionId: String(doc.id),
      scope: "aiExtraction",
    },
    logContext: {
      aiExtractionId: String(doc.id),
    },
    req,
  });

  return doc;
};

export const deleteAIExtractionExportRowsAfterAIExtractionDelete: CollectionAfterDeleteHook<
  AiExtraction
> = async ({ doc, req }) => {
  try {
    await deleteAIExtractionExportRowsForAIExtraction({
      aiExtractionId: String(doc.id),
      payload: req.payload,
      req,
    });
  } catch (err) {
    req.payload.logger.error({
      aiExtractionId: String(doc.id),
      err,
      msg: "Failed to delete AI extraction export rows after AI extraction delete",
    });
  }

  return doc;
};
