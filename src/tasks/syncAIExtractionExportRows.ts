import type { SyncAIExtractionExportRowsInput } from "@/lib/aiExtractionExportRowsJobs";
import {
  rebuildAllAIExtractionExportRows,
  syncAIExtractionExportRows,
  syncAIExtractionExportRowsForDocument,
  syncAIExtractionExportRowsForPoliticalEntity,
  syncAIExtractionExportRowsForStatus,
  syncAIExtractionExportRowsForTenant,
} from "@/lib/aiExtractionExportRows";
import { TaskConfig } from "payload";
import { getTaskLogger, withTaskTracing } from "./utils";

const isSyncExportRowsInput = (
  value: unknown,
): value is SyncAIExtractionExportRowsInput =>
  typeof value === "object" && value !== null;

const scopedInputIsMissingRequiredId = (
  input: SyncAIExtractionExportRowsInput,
): boolean =>
  (input.scope === "aiExtraction" &&
    typeof input.aiExtractionId !== "string") ||
  (input.scope === "document" && typeof input.documentId !== "string") ||
  (input.scope === "politicalEntity" &&
    typeof input.politicalEntityId !== "string") ||
  (input.scope === "status" && typeof input.statusId !== "string") ||
  (input.scope === "tenant" && typeof input.tenantId !== "string");

export const SyncAIExtractionExportRows: TaskConfig = {
  slug: "syncAIExtractionExportRows",
  label: "Sync AI Extraction Export Rows",
  handler: withTaskTracing(
    "syncAIExtractionExportRows",
    async ({ req, input }) => {
      const logger = getTaskLogger(req, "syncAIExtractionExportRows", input);
      const parsedInput = isSyncExportRowsInput(input) ? input : {};

      if (scopedInputIsMissingRequiredId(parsedInput)) {
        logger.error({
          input: parsedInput,
          message:
            "syncAIExtractionExportRows:: Refusing scoped export row sync with missing identifier",
        });

        return {
          output: {
            error: "missingIdentifier",
            scope: parsedInput.scope,
          },
        };
      }

      if (
        parsedInput.scope === "aiExtraction" &&
        typeof parsedInput.aiExtractionId === "string"
      ) {
        logger.info({
          aiExtractionId: parsedInput.aiExtractionId,
          message:
            "syncAIExtractionExportRows:: Starting AI extraction scoped export row sync",
        });

        await syncAIExtractionExportRows({
          aiExtractionId: parsedInput.aiExtractionId,
          payload: req.payload,
          req,
        });

        logger.info({
          aiExtractionId: parsedInput.aiExtractionId,
          message:
            "syncAIExtractionExportRows:: Completed AI extraction scoped export row sync",
        });

        return {
          output: {
            aiExtractionId: parsedInput.aiExtractionId,
            scope: "aiExtraction",
          },
        };
      }

      if (
        parsedInput.scope === "document" &&
        typeof parsedInput.documentId === "string"
      ) {
        logger.info({
          documentId: parsedInput.documentId,
          message:
            "syncAIExtractionExportRows:: Starting document scoped export row sync",
        });

        await syncAIExtractionExportRowsForDocument({
          documentId: parsedInput.documentId,
          payload: req.payload,
          req,
        });

        logger.info({
          documentId: parsedInput.documentId,
          message:
            "syncAIExtractionExportRows:: Completed document scoped export row sync",
        });

        return {
          output: {
            documentId: parsedInput.documentId,
            scope: "document",
          },
        };
      }

      if (
        parsedInput.scope === "status" &&
        typeof parsedInput.statusId === "string"
      ) {
        logger.info({
          message:
            "syncAIExtractionExportRows:: Starting status scoped export row sync",
          statusId: parsedInput.statusId,
        });

        await syncAIExtractionExportRowsForStatus({
          payload: req.payload,
          req,
          statusId: parsedInput.statusId,
        });

        logger.info({
          message:
            "syncAIExtractionExportRows:: Completed status scoped export row sync",
          statusId: parsedInput.statusId,
        });

        return {
          output: {
            scope: "status",
            statusId: parsedInput.statusId,
          },
        };
      }

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

      if (parsedInput.scope && parsedInput.scope !== "all") {
        logger.error({
          input: parsedInput,
          message:
            "syncAIExtractionExportRows:: Refusing export row sync with unsupported scope",
        });

        return {
          output: {
            error: "unsupportedScope",
            scope: parsedInput.scope,
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
        deletedStaleRows: result.deletedStaleRows,
        message:
          "syncAIExtractionExportRows:: Completed AI extraction export row rebuild",
        processed: result.processed,
      });

      return { output: result };
    },
  ),
};
