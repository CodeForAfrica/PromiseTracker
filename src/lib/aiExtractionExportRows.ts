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
};

type LocalAPIContext = {
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
}) => {
  await payload.delete({
    collection: AI_EXTRACTION_EXPORT_ROWS_COLLECTION,
    overrideAccess: true,
    req,
    where,
  });
};

export const syncAIExtractionExportRows = async ({
  aiExtractionId,
  payload,
  req,
}: LocalAPIContext & {
  aiExtractionId: string;
}) => {
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

  for (const row of rows) {
    const existingRow = existingRowsByKey.get(row.uniqueKey);
    syncedKeys.add(row.uniqueKey);

    if (existingRow) {
      await payload.update({
        collection: AI_EXTRACTION_EXPORT_ROWS_COLLECTION,
        data: row,
        id: existingRow.id,
        overrideAccess: true,
        req,
      });
      continue;
    }

    await payload.create({
      collection: AI_EXTRACTION_EXPORT_ROWS_COLLECTION,
      data: row,
      overrideAccess: true,
      req,
    });
  }

  if (syncedKeys.size > 0) {
    await deleteRowsWhere({
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
    await deleteRowsWhere({
      payload,
      req,
      where: {
        aiExtractionId: {
          equals: aiExtractionId,
        },
      },
    });
  }
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
  payload,
  req,
}: LocalAPIContext & {
  documentId: string;
}) => {
  await forEachMatchingDoc<Pick<AiExtraction, "id">>({
    collection: "ai-extractions",
    onDoc: async (doc) => {
      await syncAIExtractionExportRows({
        aiExtractionId: String(doc.id),
        payload,
        req,
      });
    },
    payload,
    req,
    where: {
      document: {
        equals: documentId,
      },
    },
  });
};

export const syncAIExtractionExportRowsForPoliticalEntity = async ({
  payload,
  politicalEntityId,
  req,
}: LocalAPIContext & {
  politicalEntityId: string;
}) => {
  await forEachMatchingDoc<Pick<PayloadDocument, "id">>({
    collection: "documents",
    onDoc: async (doc) => {
      await syncAIExtractionExportRowsForDocument({
        documentId: String(doc.id),
        payload,
        req,
      });
    },
    payload,
    req,
    where: {
      politicalEntity: {
        equals: politicalEntityId,
      },
    },
  });
};

export const syncAIExtractionExportRowsForTenant = async ({
  payload,
  tenantId,
  req,
}: LocalAPIContext & {
  tenantId: string;
}) => {
  await forEachMatchingDoc<Pick<PoliticalEntity, "id">>({
    collection: "political-entities",
    onDoc: async (entity) => {
      await syncAIExtractionExportRowsForPoliticalEntity({
        payload,
        politicalEntityId: String(entity.id),
        req,
      });
    },
    payload,
    req,
    where: {
      tenant: {
        equals: tenantId,
      },
    },
  });
};

export const syncAIExtractionExportRowsForStatus = async ({
  payload,
  statusId,
  req,
}: LocalAPIContext & {
  statusId: string;
}) => {
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
    await syncAIExtractionExportRows({
      aiExtractionId,
      payload,
      req,
    });
  }
};

export const rebuildAllAIExtractionExportRows = async ({
  batchSize = DEFAULT_SYNC_BATCH_SIZE,
  payload,
  req,
}: LocalAPIContext & {
  batchSize?: number;
}) => {
  const syncedAiExtractionIds = new Set<string>();
  let processed = 0;

  await forEachMatchingDoc<Pick<AiExtraction, "id">>({
    batchSize,
    collection: "ai-extractions",
    onDoc: async (doc) => {
      const aiExtractionId = String(doc.id);
      syncedAiExtractionIds.add(aiExtractionId);
      await syncAIExtractionExportRows({
        aiExtractionId,
        payload,
        req,
      });
      processed += 1;
    },
    payload,
    req,
  });

  const deletedStaleRows = await payload.count({
    collection: AI_EXTRACTION_EXPORT_ROWS_COLLECTION,
    overrideAccess: true,
    req,
    where:
      syncedAiExtractionIds.size > 0
        ? {
            aiExtractionId: {
              not_in: [...syncedAiExtractionIds],
            },
          }
        : {},
  });

  await deleteRowsWhere({
    payload,
    req,
    where:
      syncedAiExtractionIds.size > 0
        ? {
            aiExtractionId: {
              not_in: [...syncedAiExtractionIds],
            },
          }
        : {},
  });

  return { deletedStaleRows: deletedStaleRows.totalDocs, processed };
};
