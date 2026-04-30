import { queueAIExtractionExportRowsSync } from "@/lib/aiExtractionExportRowsJobs";
import type { PromiseStatus as PromiseStatusDoc } from "@/payload-types";
import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
} from "payload";

export const queueAIExtractionExportRowsSyncAfterPromiseStatusChange: CollectionAfterChangeHook<
  PromiseStatusDoc
> = async ({ doc, req }) => {
  await queueAIExtractionExportRowsSync({
    errorMessage:
      "Failed to queue AI extraction export row sync after promise status change",
    input: {
      scope: "status",
      statusId: String(doc.id),
    },
    logContext: {
      statusId: String(doc.id),
    },
    req,
  });

  return doc;
};

export const queueAIExtractionExportRowsSyncAfterPromiseStatusDelete: CollectionAfterDeleteHook<
  PromiseStatusDoc
> = async ({ doc, req }) => {
  await queueAIExtractionExportRowsSync({
    errorMessage:
      "Failed to queue AI extraction export row sync after promise status delete",
    input: {
      scope: "status",
      statusId: String(doc.id),
    },
    logContext: {
      statusId: String(doc.id),
    },
    req,
  });

  return doc;
};
