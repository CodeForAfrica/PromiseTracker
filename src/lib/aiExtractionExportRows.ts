import type {
  AiExtraction,
  Document as PayloadDocument,
  PoliticalEntity,
  PromiseStatus,
  Tenant,
} from "@/payload-types";
import type { Payload, PayloadRequest, Where } from "payload";

export const AI_EXTRACTION_EXPORT_ROWS_COLLECTION =
  "ai-extraction-export-rows" as const;

const DEFAULT_SYNC_BATCH_SIZE = 100;

type ExtractionItem = NonNullable<
  NonNullable<AiExtraction["extractions"]>[number]
>;

export type AIExtractionExportRowData = {
  uniqueKey: string;
  aiExtraction?: string;
  aiExtractionId: string;
  aiExtractionTitle: string;
  extractionRowId: string;
  uniqueId: string;
  category: string;
  summary: string;
  source: string;
  uploadError: string;
  checkMediaId: string;
  checkMediaURL: string;
  status?: string;
  statusId: string;
  statusLabel: string;
  statusMeedanId: string;
  document?: string;
  documentId: string;
  documentTitle: string;
  documentUrl: string;
  documentLanguage: string;
  documentType: string;
  documentAirtableID: string;
  politicalEntity?: string;
  politicalEntityId: string;
  politicalEntityName: string;
  politicalEntitySlug: string;
  politicalEntityPosition: string;
  tenant?: string;
  tenantId: string;
  tenantName: string;
  tenantCountry: string;
  tenantLocale: string;
};

type ExistingExportRow = {
  id: string;
  aiExtractionId?: string | null;
  uniqueKey?: string | null;
} & Record<string, unknown>;

type SyncLogger = {
  info: (logPayload: Record<string, unknown>) => void;
};

export type ExportRowSyncStats = {
  created: number;
  deleted: number;
  skipped: number;
  updated: number;
};

const emptyStats = (): ExportRowSyncStats => ({
  created: 0,
  deleted: 0,
  skipped: 0,
  updated: 0,
});

const addStats = (into: ExportRowSyncStats, from: ExportRowSyncStats): void => {
  into.created += from.created;
  into.deleted += from.deleted;
  into.skipped += from.skipped;
  into.updated += from.updated;
};

type LocalAPIContext = {
  logger?: SyncLogger;
  payload: Payload;
  req?: Partial<PayloadRequest>;
};

type SyncCollectionSlug =
  | typeof AI_EXTRACTION_EXPORT_ROWS_COLLECTION
  | "ai-extractions"
  | "documents"
  | "political-entities";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getId = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }

  if (isRecord(value) && typeof value.id === "string") {
    return value.id;
  }

  return "";
};

const getString = (value: unknown, key: string): string => {
  if (!isRecord(value)) {
    return "";
  }

  const fieldValue = value[key];
  if (typeof fieldValue === "string") {
    return fieldValue;
  }

  if (typeof fieldValue === "number" || typeof fieldValue === "boolean") {
    return String(fieldValue);
  }

  return "";
};

const getRelationshipRecord = <T>(
  value: string | T | null | undefined,
): T | null => (isRecord(value) ? (value as T) : null);

const getDocumentUrl = (document: PayloadDocument | null): string => {
  if (!document) {
    return "";
  }

  if (document.url) {
    return document.url;
  }

  const [firstDocURL] = document.docURLs ?? [];
  return firstDocURL?.url ?? "";
};

const getExtractionRowId = (
  extraction: ExtractionItem,
  index: number,
): string => getId(extraction) || String(index + 1);

const forEachMatchingDoc = async <T>({
  batchSize = DEFAULT_SYNC_BATCH_SIZE,
  collection,
  onDoc,
  payload,
  req,
  where,
}: LocalAPIContext & {
  batchSize?: number;
  collection: SyncCollectionSlug;
  onDoc: (doc: T) => Promise<void> | void;
  where?: Where;
}) => {
  let hasNextPage = true;
  let page = 1;

  while (hasNextPage) {
    const result = await payload.find({
      collection,
      depth: 0,
      limit: batchSize,
      overrideAccess: true,
      page,
      req,
      where,
    });

    for (const doc of result.docs as T[]) {
      await onDoc(doc);
    }

    hasNextPage = result.hasNextPage;
    page += 1;
  }
};

export const buildAIExtractionExportRows = (
  extractionDoc: AiExtraction,
): AIExtractionExportRowData[] => {
  const document = getRelationshipRecord<PayloadDocument>(
    extractionDoc.document,
  );
  const politicalEntity = getRelationshipRecord<PoliticalEntity>(
    document?.politicalEntity,
  );
  const tenant = getRelationshipRecord<Tenant>(politicalEntity?.tenant);
  const aiExtractionId = String(extractionDoc.id);

  return (extractionDoc.extractions ?? []).map((extraction, index) => {
    const status = getRelationshipRecord<PromiseStatus>(extraction.Status);
    const extractionRowId = getExtractionRowId(extraction, index);

    return {
      uniqueKey: `${aiExtractionId}:${extractionRowId}`,
      aiExtraction: aiExtractionId,
      aiExtractionId,
      aiExtractionTitle: extractionDoc.title ?? "",
      extractionRowId,
      uniqueId: extraction.uniqueId ?? "",
      category: extraction.category,
      summary: extraction.summary,
      source: extraction.source,
      uploadError: extraction.uploadError ?? "",
      checkMediaId: extraction.checkMediaId ?? "",
      checkMediaURL: extraction.checkMediaURL ?? "",
      status: getId(extraction.Status) || undefined,
      statusId: getId(extraction.Status),
      statusLabel: status?.label ?? "",
      statusMeedanId: status?.meedanId ?? "",
      document: getId(extractionDoc.document) || undefined,
      documentId: getId(extractionDoc.document),
      documentTitle: document?.title ?? "",
      documentUrl: getDocumentUrl(document),
      documentLanguage: document?.language ?? "",
      documentType: document?.type ?? "",
      documentAirtableID: document?.airtableID ?? "",
      politicalEntity: getId(document?.politicalEntity) || undefined,
      politicalEntityId: getId(document?.politicalEntity),
      politicalEntityName: politicalEntity?.name ?? "",
      politicalEntitySlug: politicalEntity?.slug ?? "",
      politicalEntityPosition: politicalEntity?.position ?? "",
      tenant: getId(politicalEntity?.tenant) || undefined,
      tenantId: getId(politicalEntity?.tenant),
      tenantName: tenant?.name ?? "",
      tenantCountry: getString(tenant, "country"),
      tenantLocale: getString(tenant, "locale"),
    };
  });
};

const EXPORT_ROW_FIELDS = [
  "uniqueKey",
  "aiExtraction",
  "aiExtractionId",
  "aiExtractionTitle",
  "extractionRowId",
  "uniqueId",
  "category",
  "summary",
  "source",
  "uploadError",
  "checkMediaId",
  "checkMediaURL",
  "status",
  "statusId",
  "statusLabel",
  "statusMeedanId",
  "document",
  "documentId",
  "documentTitle",
  "documentUrl",
  "documentLanguage",
  "documentType",
  "documentAirtableID",
  "politicalEntity",
  "politicalEntityId",
  "politicalEntityName",
  "politicalEntitySlug",
  "politicalEntityPosition",
  "tenant",
  "tenantId",
  "tenantName",
  "tenantCountry",
  "tenantLocale",
] as const satisfies ReadonlyArray<keyof AIExtractionExportRowData>;

// Empty strings, null, undefined, and populated-vs-id relationship values all
// count as equal so a no-op sync issues no writes.
const normalizeFieldValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (isRecord(value) && typeof value.id === "string") {
    return value.id;
  }
  return String(value);
};

const isRowUnchanged = (
  existingRow: ExistingExportRow,
  row: AIExtractionExportRowData,
): boolean =>
  EXPORT_ROW_FIELDS.every(
    (field) =>
      normalizeFieldValue(existingRow[field]) ===
      normalizeFieldValue(row[field]),
  );

const findExistingRows = async ({
  aiExtractionId,
  payload,
  req,
}: LocalAPIContext & {
  aiExtractionId: string;
}): Promise<ExistingExportRow[]> => {
  const docs: ExistingExportRow[] = [];

  await forEachMatchingDoc<ExistingExportRow>({
    collection: AI_EXTRACTION_EXPORT_ROWS_COLLECTION,
    onDoc: (doc) => {
      docs.push(doc);
    },
    payload,
    req,
    where: {
      aiExtractionId: {
        equals: aiExtractionId,
      },
    },
  });

  return docs;
};

const deleteRowsWhere = async ({
  payload,
  req,
  where,
}: LocalAPIContext & {
  where: Where;
}): Promise<number> => {
  const result = await payload.delete({
    collection: AI_EXTRACTION_EXPORT_ROWS_COLLECTION,
    overrideAccess: true,
    req,
    where,
  });

  return Array.isArray(result?.docs) ? result.docs.length : 0;
};

const logScopedSyncError = ({
  context,
  err,
  message,
  payload,
}: {
  context: Record<string, unknown>;
  err: unknown;
  message: string;
  payload: Payload;
}) => {
  payload.logger?.error({
    ...context,
    err,
    msg: message,
  });
};

const aiExtractionExists = async ({
  aiExtractionId,
  payload,
  req,
}: LocalAPIContext & {
  aiExtractionId: string;
}): Promise<boolean> => {
  const result = await payload.find({
    collection: "ai-extractions",
    depth: 0,
    limit: 1,
    overrideAccess: true,
    req,
    where: {
      id: {
        equals: aiExtractionId,
      },
    },
  });

  return result.docs.length > 0;
};

const findOrphanedAIExtractionIds = async ({
  payload,
  req,
  retainedAIExtractionIds,
}: LocalAPIContext & {
  retainedAIExtractionIds: Set<string>;
}): Promise<string[]> => {
  const candidateAIExtractionIds = new Set<string>();
  const orphanedAIExtractionIds: string[] = [];

  await forEachMatchingDoc<ExistingExportRow>({
    collection: AI_EXTRACTION_EXPORT_ROWS_COLLECTION,
    onDoc: (doc) => {
      if (doc.aiExtractionId) {
        candidateAIExtractionIds.add(doc.aiExtractionId);
      }
    },
    payload,
    req,
    where: {
      aiExtractionId: {
        not_in: [...retainedAIExtractionIds],
      },
    },
  });

  for (const aiExtractionId of candidateAIExtractionIds) {
    if (
      retainedAIExtractionIds.has(aiExtractionId) ||
      (await aiExtractionExists({
        aiExtractionId,
        payload,
        req,
      }))
    ) {
      continue;
    }

    orphanedAIExtractionIds.push(aiExtractionId);
  }

  return orphanedAIExtractionIds;
};

export const syncAIExtractionExportRows = async ({
  aiExtractionId,
  logger,
  payload,
  req,
}: LocalAPIContext & {
  aiExtractionId: string;
}): Promise<ExportRowSyncStats> => {
  const extractionDoc = (await payload.findByID({
    collection: "ai-extractions",
    depth: 3,
    id: aiExtractionId,
    overrideAccess: true,
    req,
  })) as AiExtraction;

  const rows = buildAIExtractionExportRows(extractionDoc);
  const existingRows = await findExistingRows({ aiExtractionId, payload, req });
  const existingRowsByKey = new Map(
    existingRows
      .filter((row) => row.uniqueKey)
      .map((row) => [row.uniqueKey as string, row]),
  );
  const syncedKeys = new Set<string>();
  const stats = emptyStats();

  for (const row of rows) {
    const existingRow = existingRowsByKey.get(row.uniqueKey);
    syncedKeys.add(row.uniqueKey);

    if (existingRow) {
      if (isRowUnchanged(existingRow, row)) {
        stats.skipped += 1;
        continue;
      }

      await payload.update({
        collection: AI_EXTRACTION_EXPORT_ROWS_COLLECTION,
        data: row,
        id: existingRow.id,
        overrideAccess: true,
        req,
      });
      stats.updated += 1;
      continue;
    }

    await payload.create({
      collection: AI_EXTRACTION_EXPORT_ROWS_COLLECTION,
      data: row,
      overrideAccess: true,
      req,
    });
    stats.created += 1;
  }

  if (syncedKeys.size > 0) {
    stats.deleted = await deleteRowsWhere({
      payload,
      req,
      where: {
        and: [
          {
            aiExtractionId: {
              equals: aiExtractionId,
            },
          },
          {
            uniqueKey: {
              not_in: [...syncedKeys],
            },
          },
        ],
      },
    });
  } else {
    stats.deleted = await deleteRowsWhere({
      payload,
      req,
      where: {
        aiExtractionId: {
          equals: aiExtractionId,
        },
      },
    });
  }

  logger?.info({
    aiExtractionId,
    message: "aiExtractionExportRows:: Extraction synced",
    rowCount: rows.length,
    ...stats,
  });

  return stats;
};

export const deleteAIExtractionExportRowsForAIExtraction = async ({
  aiExtractionId,
  payload,
  req,
}: LocalAPIContext & {
  aiExtractionId: string;
}) =>
  deleteRowsWhere({
    payload,
    req,
    where: {
      aiExtractionId: {
        equals: aiExtractionId,
      },
    },
  });

export const deleteAIExtractionExportRowsForDocument = async ({
  documentId,
  payload,
  req,
}: LocalAPIContext & {
  documentId: string;
}) =>
  deleteRowsWhere({
    payload,
    req,
    where: {
      documentId: {
        equals: documentId,
      },
    },
  });

export const deleteAIExtractionExportRowsForPoliticalEntity = async ({
  payload,
  politicalEntityId,
  req,
}: LocalAPIContext & {
  politicalEntityId: string;
}) =>
  deleteRowsWhere({
    payload,
    req,
    where: {
      politicalEntityId: {
        equals: politicalEntityId,
      },
    },
  });

export const deleteAIExtractionExportRowsForTenant = async ({
  payload,
  tenantId,
  req,
}: LocalAPIContext & {
  tenantId: string;
}) =>
  deleteRowsWhere({
    payload,
    req,
    where: {
      tenantId: {
        equals: tenantId,
      },
    },
  });

export const syncAIExtractionExportRowsForDocument = async ({
  documentId,
  logger,
  payload,
  req,
}: LocalAPIContext & {
  documentId: string;
}): Promise<ExportRowSyncStats> => {
  const stats = emptyStats();

  await forEachMatchingDoc<Pick<AiExtraction, "id">>({
    collection: "ai-extractions",
    onDoc: async (doc) => {
      try {
        addStats(
          stats,
          await syncAIExtractionExportRows({
            aiExtractionId: String(doc.id),
            logger,
            payload,
            req,
          }),
        );
      } catch (err) {
        logScopedSyncError({
          context: { aiExtractionId: String(doc.id), documentId },
          err,
          message:
            "Failed to sync AI extraction export rows for document-scoped sync item",
          payload,
        });
      }
    },
    payload,
    req,
    where: {
      document: {
        equals: documentId,
      },
    },
  });

  return stats;
};

export const syncAIExtractionExportRowsForPoliticalEntity = async ({
  logger,
  payload,
  politicalEntityId,
  req,
}: LocalAPIContext & {
  politicalEntityId: string;
}): Promise<ExportRowSyncStats> => {
  const stats = emptyStats();

  await forEachMatchingDoc<Pick<PayloadDocument, "id">>({
    collection: "documents",
    onDoc: async (doc) => {
      try {
        addStats(
          stats,
          await syncAIExtractionExportRowsForDocument({
            documentId: String(doc.id),
            logger,
            payload,
            req,
          }),
        );
      } catch (err) {
        logScopedSyncError({
          context: { documentId: String(doc.id), politicalEntityId },
          err,
          message:
            "Failed to sync AI extraction export rows for political-entity-scoped document",
          payload,
        });
      }
    },
    payload,
    req,
    where: {
      politicalEntity: {
        equals: politicalEntityId,
      },
    },
  });

  return stats;
};

export const syncAIExtractionExportRowsForTenant = async ({
  logger,
  payload,
  tenantId,
  req,
}: LocalAPIContext & {
  tenantId: string;
}): Promise<ExportRowSyncStats> => {
  const stats = emptyStats();

  await forEachMatchingDoc<Pick<PoliticalEntity, "id">>({
    collection: "political-entities",
    onDoc: async (entity) => {
      try {
        addStats(
          stats,
          await syncAIExtractionExportRowsForPoliticalEntity({
            logger,
            payload,
            politicalEntityId: String(entity.id),
            req,
          }),
        );
      } catch (err) {
        logScopedSyncError({
          context: { politicalEntityId: String(entity.id), tenantId },
          err,
          message:
            "Failed to sync AI extraction export rows for tenant-scoped political entity",
          payload,
        });
      }
    },
    payload,
    req,
    where: {
      tenant: {
        equals: tenantId,
      },
    },
  });

  return stats;
};

export const syncAIExtractionExportRowsForStatus = async ({
  logger,
  payload,
  statusId,
  req,
}: LocalAPIContext & {
  statusId: string;
}): Promise<ExportRowSyncStats> => {
  const stats = emptyStats();
  const aiExtractionIds = new Set<string>();

  await forEachMatchingDoc<ExistingExportRow>({
    collection: AI_EXTRACTION_EXPORT_ROWS_COLLECTION,
    onDoc: (doc) => {
      if (doc.aiExtractionId) {
        aiExtractionIds.add(doc.aiExtractionId);
      }
    },
    payload,
    req,
    where: {
      statusId: {
        equals: statusId,
      },
    },
  });

  for (const aiExtractionId of aiExtractionIds) {
    try {
      addStats(
        stats,
        await syncAIExtractionExportRows({
          aiExtractionId,
          logger,
          payload,
          req,
        }),
      );
    } catch (err) {
      logScopedSyncError({
        context: { aiExtractionId, statusId },
        err,
        message:
          "Failed to sync AI extraction export rows for status-scoped AI extraction",
        payload,
      });
    }
  }

  return stats;
};

export const rebuildAllAIExtractionExportRows = async ({
  batchSize = DEFAULT_SYNC_BATCH_SIZE,
  logger,
  payload,
  req,
}: LocalAPIContext & {
  batchSize?: number;
}) => {
  const syncedAiExtractionIds = new Set<string>();
  const stats = emptyStats();
  let processed = 0;

  await forEachMatchingDoc<Pick<AiExtraction, "id">>({
    batchSize,
    collection: "ai-extractions",
    onDoc: async (doc) => {
      const aiExtractionId = String(doc.id);
      syncedAiExtractionIds.add(aiExtractionId);
      addStats(
        stats,
        await syncAIExtractionExportRows({
          aiExtractionId,
          logger,
          payload,
          req,
        }),
      );
      processed += 1;

      if (processed % batchSize === 0) {
        logger?.info({
          message: "aiExtractionExportRows:: Rebuild progress",
          processed,
          ...stats,
        });
      }
    },
    payload,
    req,
  });

  if (syncedAiExtractionIds.size === 0) {
    return { deletedStaleRows: 0, processed, ...stats };
  }

  // Only delete rows whose parent AI extraction is confirmed missing now.
  // This avoids deleting rows created concurrently after the rebuild scan started.
  const orphanedAIExtractionIds = await findOrphanedAIExtractionIds({
    payload,
    req,
    retainedAIExtractionIds: syncedAiExtractionIds,
  });

  if (orphanedAIExtractionIds.length === 0) {
    return { deletedStaleRows: 0, processed, ...stats };
  }

  const deletedStaleRows = await payload.count({
    collection: AI_EXTRACTION_EXPORT_ROWS_COLLECTION,
    overrideAccess: true,
    req,
    where: {
      aiExtractionId: {
        in: orphanedAIExtractionIds,
      },
    },
  });

  await deleteRowsWhere({
    payload,
    req,
    where: {
      aiExtractionId: {
        in: orphanedAIExtractionIds,
      },
    },
  });

  return { deletedStaleRows: deletedStaleRows.totalDocs, processed, ...stats };
};
