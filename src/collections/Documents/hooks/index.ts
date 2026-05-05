import { deleteAIExtractionExportRowsForDocument } from "@/lib/aiExtractionExportRows";
import { queueAIExtractionExportRowsSync } from "@/lib/aiExtractionExportRowsJobs";
import type { Document as PayloadDocument } from "@/payload-types";
import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
} from "payload";

export const queueAIExtractionExportRowsSyncAfterDocumentChange: CollectionAfterChangeHook<
  PayloadDocument
> = async ({ doc, req }) => {
  await queueAIExtractionExportRowsSync({
    errorMessage:
      "Failed to queue AI extraction export row sync after document change",
    input: {
      documentId: String(doc.id),
      scope: "document",
    },
    logContext: {
      documentId: String(doc.id),
    },
    req,
  });

  return doc;
};

export const deleteAIExtractionExportRowsAfterDocumentDelete: CollectionAfterDeleteHook<
  PayloadDocument
> = async ({ doc, req }) => {
  try {
    await deleteAIExtractionExportRowsForDocument({
      documentId: String(doc.id),
      payload: req.payload,
      req,
    });
  } catch (err) {
    req.payload.logger.error({
      documentId: String(doc.id),
      err,
      msg: "Failed to delete AI extraction export rows after document delete",
    });
  }

  return doc;
};
