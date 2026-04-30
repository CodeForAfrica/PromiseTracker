import {
  rebuildAllAIExtractionExportRows,
  syncAIExtractionExportRowsForPoliticalEntity,
  syncAIExtractionExportRowsForTenant,
} from "@/lib/aiExtractionExportRows";
import { TaskConfig } from "payload";
import { getTaskLogger, withTaskTracing } from "./utils";

type SyncExportRowsInput = {
  politicalEntityId?: string;
  scope?: "all" | "politicalEntity" | "tenant";
  tenantId?: string;
};

const isSyncExportRowsInput = (value: unknown): value is SyncExportRowsInput =>
  typeof value === "object" && value !== null;

export const SyncAIExtractionExportRows: TaskConfig = {
  slug: "syncAIExtractionExportRows",
  label: "Sync AI Extraction Export Rows",
  handler: withTaskTracing(
    "syncAIExtractionExportRows",
    async ({ req, input }) => {
      const logger = getTaskLogger(req, "syncAIExtractionExportRows", input);
      const parsedInput = isSyncExportRowsInput(input) ? input : {};

      if (
        parsedInput.scope === "tenant" &&
        typeof parsedInput.tenantId === "string"
      ) {
        logger.info({
          message:
            "syncAIExtractionExportRows:: Starting tenant-scoped export row sync",
          tenantId: parsedInput.tenantId,
        });

        await syncAIExtractionExportRowsForTenant({
          payload: req.payload,
          req,
          tenantId: parsedInput.tenantId,
        });

        logger.info({
          message:
            "syncAIExtractionExportRows:: Completed tenant-scoped export row sync",
          tenantId: parsedInput.tenantId,
        });

        return { output: { scope: "tenant", tenantId: parsedInput.tenantId } };
      }

      if (
        parsedInput.scope === "politicalEntity" &&
        typeof parsedInput.politicalEntityId === "string"
      ) {
        logger.info({
          message:
            "syncAIExtractionExportRows:: Starting political-entity-scoped export row sync",
          politicalEntityId: parsedInput.politicalEntityId,
        });

        await syncAIExtractionExportRowsForPoliticalEntity({
          payload: req.payload,
          politicalEntityId: parsedInput.politicalEntityId,
          req,
        });

        logger.info({
          message:
            "syncAIExtractionExportRows:: Completed political-entity-scoped export row sync",
          politicalEntityId: parsedInput.politicalEntityId,
        });

        return {
          output: {
            politicalEntityId: parsedInput.politicalEntityId,
            scope: "politicalEntity",
          },
        };
      }

      logger.info(
        "syncAIExtractionExportRows:: Rebuilding AI extraction export rows",
      );

      const result = await rebuildAllAIExtractionExportRows({
        payload: req.payload,
        req,
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
