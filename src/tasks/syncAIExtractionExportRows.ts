import { rebuildAllAIExtractionExportRows } from "@/lib/aiExtractionExportRows";
import { TaskConfig } from "payload";
import { getTaskLogger, withTaskTracing } from "./utils";

export const SyncAIExtractionExportRows: TaskConfig = {
  slug: "syncAIExtractionExportRows",
  label: "Sync AI Extraction Export Rows",
  handler: withTaskTracing(
    "syncAIExtractionExportRows",
    async ({ req, input }) => {
      const logger = getTaskLogger(req, "syncAIExtractionExportRows", input);

      logger.info(
        "syncAIExtractionExportRows:: Rebuilding AI extraction export rows",
      );

      const result = await rebuildAllAIExtractionExportRows({
        payload: req.payload,
      });

      logger.info({
        message:
          "syncAIExtractionExportRows:: Completed AI extraction export row rebuild",
        processed: result.processed,
      });

      return { output: result };
    },
  ),
};
