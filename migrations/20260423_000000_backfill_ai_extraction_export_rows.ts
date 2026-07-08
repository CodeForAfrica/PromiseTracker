import type {
  MigrateDownArgs,
  MigrateUpArgs,
  MongooseAdapter,
} from "@payloadcms/db-mongodb";
import type { AIExtractionExportRowData } from "../src/lib/aiExtractionExportRows";
import { AI_EXTRACTION_EXPORT_ROWS_COLLECTION } from "../src/lib/aiExtractionExportRows";
import { defaultLocale, type PayloadLocale } from "../src/utils/locales";

const DEFAULT_BACKFILL_BATCH_SIZE = 100;

type RawLocalizedValue =
  | Partial<Record<PayloadLocale, string>>
  | Record<string, unknown>
  | string
  | null
  | undefined;

type RawExtractionItem = {
  _id?: unknown;
  id?: string;
  category?: string;
  summary?: string;
  source?: string;
  uniqueId?: string;
  checkMediaId?: string;
  checkMediaURL?: string;
  Status?: unknown;
  uploadError?: string;
};

type RawAIExtraction = {
  _id: unknown;
  title?: string;
  document?: unknown;
  extractions?: RawExtractionItem[];
};

type RawDocument = {
  _id: unknown;
  airtableID?: string;
  docURLs?: { url?: string | null }[];
  language?: string;
  politicalEntity?: unknown;
  title?: string;
  type?: string;
  url?: string;
};

type RawPoliticalEntity = {
  _id: unknown;
  name?: string;
  position?: string;
  slug?: string;
  tenant?: unknown;
};

type RawTenant = {
  _id: unknown;
  country?: string;
  locale?: string;
  name?: string;
};

type RawPromiseStatus = {
  _id: unknown;
  label?: RawLocalizedValue;
  meedanId?: string;
};

type ExportRowWriteModel = AIExtractionExportRowData & {
  createdAt: Date;
  updatedAt: Date;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getBackfillBatchSize = (): number => {
  const raw = Number(
    process.env.PAYLOAD_AI_EXTRACTION_EXPORT_BACKFILL_BATCH_SIZE,
  );
  return Number.isFinite(raw) && raw > 0
    ? Math.floor(raw)
    : DEFAULT_BACKFILL_BATCH_SIZE;
};

const getString = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return "";
};

const toIDString = (value: unknown): string => {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toHexString" in value &&
    typeof value.toHexString === "function"
  ) {
    return value.toHexString();
  }

  if (isRecord(value)) {
    if (typeof value.id === "string") {
      return value.id;
    }

    if ("_id" in value && value._id && value._id !== value) {
      return toIDString(value._id);
    }
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toString" in value &&
    typeof value.toString === "function"
  ) {
    return value.toString();
  }

  return "";
};

const getLocalizedString = (value: RawLocalizedValue): string => {
  if (typeof value === "string") {
    return value;
  }

  if (!isRecord(value)) {
    return "";
  }

  const localizedValue = value[defaultLocale];
  if (typeof localizedValue === "string") {
    return localizedValue;
  }

  for (const candidate of Object.values(value)) {
    if (typeof candidate === "string") {
      return candidate;
    }
  }

  return "";
};

const getDocumentUrl = (document?: RawDocument): string => {
  if (!document) {
    return "";
  }

  if (document.url) {
    return document.url;
  }

  const [firstDocURL] = document.docURLs ?? [];
  return typeof firstDocURL?.url === "string" ? firstDocURL.url : "";
};

const getExtractionRowID = (
  extraction: RawExtractionItem,
  index: number,
): string => toIDString(extraction.id ?? extraction._id) || String(index + 1);

const dedupeRefs = (values: unknown[]): unknown[] => {
  const refs = new Map<string, unknown>();

  for (const value of values) {
    const id = toIDString(value);
    if (!id) {
      continue;
    }

    refs.set(id, value);
  }

  return [...refs.values()];
};

const createLookupMap = <T extends { _id: unknown }>(
  docs: T[],
): Map<string, T> => new Map(docs.map((doc) => [toIDString(doc._id), doc]));

const fetchByIDs = async <T extends { _id: unknown }>({
  ids,
  model,
  projection,
}: {
  ids: unknown[];
  model: { find: (...args: unknown[]) => Promise<T[]> };
  projection: Record<string, 1>;
}): Promise<Map<string, T>> => {
  if (ids.length === 0) {
    return new Map();
  }

  const docs = (await model.find(
    {
      _id: {
        $in: ids,
      },
    },
    projection,
    {
      lean: true,
    },
  )) as T[];

  return createLookupMap(docs);
};

const buildBatchRows = ({
  aiExtractions,
  documents,
  politicalEntities,
  statuses,
  tenants,
}: {
  aiExtractions: RawAIExtraction[];
  documents: Map<string, RawDocument>;
  politicalEntities: Map<string, RawPoliticalEntity>;
  statuses: Map<string, RawPromiseStatus>;
  tenants: Map<string, RawTenant>;
}): ExportRowWriteModel[] => {
  const now = new Date();
  const rows: ExportRowWriteModel[] = [];

  for (const extractionDoc of aiExtractions) {
    const aiExtractionId = toIDString(extractionDoc._id);
    const documentId = toIDString(extractionDoc.document);
    const document = documents.get(documentId);
    const politicalEntityId = toIDString(document?.politicalEntity);
    const politicalEntity = politicalEntities.get(politicalEntityId);
    const tenantId = toIDString(politicalEntity?.tenant);
    const tenant = tenants.get(tenantId);

    for (const [index, extraction] of (
      extractionDoc.extractions ?? []
    ).entries()) {
      const extractionRowId = getExtractionRowID(extraction, index);
      const statusId = toIDString(extraction.Status);
      const status = statuses.get(statusId);

      rows.push({
        uniqueKey: `${aiExtractionId}:${extractionRowId}`,
        aiExtraction: aiExtractionId || undefined,
        aiExtractionId,
        aiExtractionTitle: getString(extractionDoc.title),
        extractionRowId,
        uniqueId: getString(extraction.uniqueId),
        category: getString(extraction.category),
        summary: getString(extraction.summary),
        source: getString(extraction.source),
        uploadError: getString(extraction.uploadError),
        checkMediaId: getString(extraction.checkMediaId),
        checkMediaURL: getString(extraction.checkMediaURL),
        status: statusId || undefined,
        statusId,
        statusLabel: getLocalizedString(status?.label),
        statusMeedanId: getString(status?.meedanId),
        document: documentId || undefined,
        documentId,
        documentTitle: getString(document?.title),
        documentUrl: getDocumentUrl(document),
        documentLanguage: getString(document?.language),
        documentType: getString(document?.type),
        documentAirtableID: getString(document?.airtableID),
        politicalEntity: politicalEntityId || undefined,
        politicalEntityId,
        politicalEntityName: getString(politicalEntity?.name),
        politicalEntitySlug: getString(politicalEntity?.slug),
        politicalEntityPosition: getString(politicalEntity?.position),
        tenant: tenantId || undefined,
        tenantId,
        tenantName: getString(tenant?.name),
        tenantCountry: getString(tenant?.country),
        tenantLocale: getString(tenant?.locale),
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  return rows;
};

const backfillAIExtractionExportRows = async ({
  payload,
}: MigrateUpArgs): Promise<void> => {
  const batchSize = getBackfillBatchSize();
  const db = payload.db as MongooseAdapter;
  const aiExtractionsModel = db.collections["ai-extractions"];
  const documentsModel = db.collections.documents;
  const politicalEntitiesModel = db.collections["political-entities"];
  const tenantsModel = db.collections.tenants;
  const promiseStatusModel = db.collections["promise-status"];
  const exportRowsModel = db.collections[AI_EXTRACTION_EXPORT_ROWS_COLLECTION];

  if (
    !aiExtractionsModel ||
    !documentsModel ||
    !politicalEntitiesModel ||
    !tenantsModel ||
    !promiseStatusModel ||
    !exportRowsModel
  ) {
    throw new Error(
      "Failed to resolve one or more collections for AI extraction export row backfill",
    );
  }

  let lastID: unknown;
  let processedAIExtractions = 0;
  let writtenRows = 0;

  payload.logger.info({
    msg: "aiExtractionExportRowsBackfill:: Starting migration backfill",
    batchSize,
  });

  while (true) {
    const batch = (await aiExtractionsModel.find(
      lastID
        ? {
            _id: {
              $gt: lastID,
            },
          }
        : {},
      {
        title: 1,
        document: 1,
        extractions: 1,
      },
      {
        lean: true,
        limit: batchSize,
        sort: {
          _id: 1,
        },
      },
    )) as RawAIExtraction[];

    if (batch.length === 0) {
      break;
    }

    lastID = batch[batch.length - 1]?._id;

    const documentIDs = dedupeRefs(batch.map((doc) => doc.document));
    const statusIDs = dedupeRefs(
      batch.flatMap((doc) =>
        (doc.extractions ?? []).map((extraction) => extraction.Status),
      ),
    );

    const [documents, statuses] = await Promise.all([
      fetchByIDs<RawDocument>({
        ids: documentIDs,
        model: documentsModel,
        projection: {
          title: 1,
          url: 1,
          docURLs: 1,
          politicalEntity: 1,
          language: 1,
          type: 1,
          airtableID: 1,
        },
      }),
      fetchByIDs<RawPromiseStatus>({
        ids: statusIDs,
        model: promiseStatusModel,
        projection: {
          label: 1,
          meedanId: 1,
        },
      }),
    ]);

    const politicalEntityIDs = dedupeRefs(
      [...documents.values()].map((document) => document.politicalEntity),
    );
    const politicalEntities = await fetchByIDs<RawPoliticalEntity>({
      ids: politicalEntityIDs,
      model: politicalEntitiesModel,
      projection: {
        name: 1,
        slug: 1,
        position: 1,
        tenant: 1,
      },
    });

    const tenantIDs = dedupeRefs(
      [...politicalEntities.values()].map((entity) => entity.tenant),
    );
    const tenants = await fetchByIDs<RawTenant>({
      ids: tenantIDs,
      model: tenantsModel,
      projection: {
        name: 1,
        country: 1,
        locale: 1,
      },
    });

    const batchRows = buildBatchRows({
      aiExtractions: batch,
      documents,
      politicalEntities,
      statuses,
      tenants,
    });
    const batchAIExtractionIDs = batch
      .map((doc) => toIDString(doc._id))
      .filter((id): id is string => Boolean(id));

    await exportRowsModel.collection.deleteMany({
      aiExtractionId: {
        $in: batchAIExtractionIDs,
      },
    });

    if (batchRows.length > 0) {
      await exportRowsModel.collection.insertMany(batchRows, {
        ordered: false,
      });
    }

    processedAIExtractions += batch.length;
    writtenRows += batchRows.length;

    payload.logger.info({
      msg: "aiExtractionExportRowsBackfill:: Processed batch",
      batchAIExtractions: batch.length,
      batchRows: batchRows.length,
      processedAIExtractions,
      writtenRows,
    });
  }

  payload.logger.info({
    msg: "aiExtractionExportRowsBackfill:: Completed migration backfill",
    processedAIExtractions,
    writtenRows,
  });
};

export async function up(args: MigrateUpArgs): Promise<void> {
  await backfillAIExtractionExportRows(args);
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  const db = payload.db as MongooseAdapter;
  const exportRowsModel = db.collections[AI_EXTRACTION_EXPORT_ROWS_COLLECTION];

  if (!exportRowsModel) {
    throw new Error(
      "Failed to resolve AI extraction export rows collection for migration rollback",
    );
  }

  await exportRowsModel.collection.deleteMany({});
}
