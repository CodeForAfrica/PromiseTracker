import type {
  AiExtraction,
  Document as PayloadDocument,
  PoliticalEntity,
  PromiseStatus,
  Tenant,
} from "@/payload-types";
import type { Payload, Where } from "payload";

export const AI_EXTRACTION_EXPORT_ROWS_COLLECTION =
  "ai-extraction-export-rows" as const;

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
): string => extraction.uniqueId ?? extraction.id ?? String(index + 1);

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
}: {
  aiExtractionId: string;
  payload: Payload;
}): Promise<ExistingExportRow[]> => {
  const { docs } = await payload.find({
    collection: AI_EXTRACTION_EXPORT_ROWS_COLLECTION,
    depth: 0,
    limit: 0,
    overrideAccess: true,
    where: {
      aiExtractionId: {
        equals: aiExtractionId,
      },
    },
  });

  return docs as ExistingExportRow[];
};

const deleteRowsWhere = async ({
  payload,
  where,
}: {
  payload: Payload;
  where: Where;
}) => {
  const { docs } = await payload.find({
    collection: AI_EXTRACTION_EXPORT_ROWS_COLLECTION,
    depth: 0,
    limit: 0,
    overrideAccess: true,
    where,
  });

  for (const row of docs as ExistingExportRow[]) {
    await payload.delete({
      collection: AI_EXTRACTION_EXPORT_ROWS_COLLECTION,
      id: row.id,
      overrideAccess: true,
    });
  }
};

export const syncAIExtractionExportRows = async ({
  aiExtractionId,
  payload,
}: {
  aiExtractionId: string;
  payload: Payload;
}) => {
  const extractionDoc = (await payload.findByID({
    collection: "ai-extractions",
    depth: 3,
    id: aiExtractionId,
    overrideAccess: true,
  })) as AiExtraction;

  const rows = buildAIExtractionExportRows(extractionDoc);
  const existingRows = await findExistingRows({ aiExtractionId, payload });
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
      });
      continue;
    }

    await payload.create({
      collection: AI_EXTRACTION_EXPORT_ROWS_COLLECTION,
      data: row,
      overrideAccess: true,
    });
  }

  for (const row of existingRows) {
    if (row.uniqueKey && syncedKeys.has(row.uniqueKey)) {
      continue;
    }

    await payload.delete({
      collection: AI_EXTRACTION_EXPORT_ROWS_COLLECTION,
      id: row.id,
      overrideAccess: true,
    });
  }
};

export const deleteAIExtractionExportRowsForAIExtraction = async ({
  aiExtractionId,
  payload,
}: {
  aiExtractionId: string;
  payload: Payload;
}) =>
  deleteRowsWhere({
    payload,
    where: {
      aiExtractionId: {
        equals: aiExtractionId,
      },
    },
  });

export const deleteAIExtractionExportRowsForDocument = async ({
  documentId,
  payload,
}: {
  documentId: string;
  payload: Payload;
}) =>
  deleteRowsWhere({
    payload,
    where: {
      documentId: {
        equals: documentId,
      },
    },
  });

export const deleteAIExtractionExportRowsForPoliticalEntity = async ({
  payload,
  politicalEntityId,
}: {
  payload: Payload;
  politicalEntityId: string;
}) =>
  deleteRowsWhere({
    payload,
    where: {
      politicalEntityId: {
        equals: politicalEntityId,
      },
    },
  });

export const deleteAIExtractionExportRowsForTenant = async ({
  payload,
  tenantId,
}: {
  payload: Payload;
  tenantId: string;
}) =>
  deleteRowsWhere({
    payload,
    where: {
      tenantId: {
        equals: tenantId,
      },
    },
  });

export const syncAIExtractionExportRowsForDocument = async ({
  documentId,
  payload,
}: {
  documentId: string;
  payload: Payload;
}) => {
  const { docs } = await payload.find({
    collection: "ai-extractions",
    depth: 0,
    limit: 0,
    overrideAccess: true,
    where: {
      document: {
        equals: documentId,
      },
    },
  });

  for (const doc of docs as Pick<AiExtraction, "id">[]) {
    await syncAIExtractionExportRows({
      aiExtractionId: String(doc.id),
      payload,
    });
  }
};

export const syncAIExtractionExportRowsForPoliticalEntity = async ({
  payload,
  politicalEntityId,
}: {
  payload: Payload;
  politicalEntityId: string;
}) => {
  const { docs } = await payload.find({
    collection: "documents",
    depth: 0,
    limit: 0,
    overrideAccess: true,
    where: {
      politicalEntity: {
        equals: politicalEntityId,
      },
    },
  });

  for (const doc of docs as Pick<PayloadDocument, "id">[]) {
    await syncAIExtractionExportRowsForDocument({
      documentId: String(doc.id),
      payload,
    });
  }
};

export const syncAIExtractionExportRowsForTenant = async ({
  payload,
  tenantId,
}: {
  payload: Payload;
  tenantId: string;
}) => {
  const { docs } = await payload.find({
    collection: "political-entities",
    depth: 0,
    limit: 0,
    overrideAccess: true,
    where: {
      tenant: {
        equals: tenantId,
      },
    },
  });

  for (const entity of docs as Pick<PoliticalEntity, "id">[]) {
    await syncAIExtractionExportRowsForPoliticalEntity({
      payload,
      politicalEntityId: String(entity.id),
    });
  }
};

export const syncAIExtractionExportRowsForStatus = async ({
  payload,
  statusId,
}: {
  payload: Payload;
  statusId: string;
}) => {
  const { docs } = await payload.find({
    collection: AI_EXTRACTION_EXPORT_ROWS_COLLECTION,
    depth: 0,
    limit: 0,
    overrideAccess: true,
    where: {
      statusId: {
        equals: statusId,
      },
    },
  });

  const aiExtractionIds = [
    ...new Set(
      (docs as ExistingExportRow[])
        .map((doc) => doc.aiExtractionId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  for (const aiExtractionId of aiExtractionIds) {
    await syncAIExtractionExportRows({
      aiExtractionId,
      payload,
    });
  }
};

export const rebuildAllAIExtractionExportRows = async ({
  batchSize = 100,
  payload,
}: {
  batchSize?: number;
  payload: Payload;
}) => {
  await deleteRowsWhere({
    payload,
    where: {},
  });

  let hasNextPage = true;
  let page = 1;
  let processed = 0;

  while (hasNextPage) {
    const { docs, hasNextPage: nextPage } = await payload.find({
      collection: "ai-extractions",
      depth: 0,
      limit: batchSize,
      overrideAccess: true,
      page,
    });

    for (const doc of docs as Pick<AiExtraction, "id">[]) {
      await syncAIExtractionExportRows({
        aiExtractionId: String(doc.id),
        payload,
      });
      processed += 1;
    }

    hasNextPage = nextPage;
    page += 1;
  }

  return { processed };
};
