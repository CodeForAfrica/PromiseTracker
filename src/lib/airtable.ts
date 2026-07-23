import { AirtableTs } from "airtable-ts";
import {
  documentsTable as documentListTable,
  countriesTable,
  PoliticalEntitiestable,
} from "@/types/airtableSchema";
import { formula } from "airtable-ts-formula";

const MILLISECONDS_IN_SECOND = 1000;
const MAX_AIRTABLE_STATUS_LENGTH = 500;

const getAirtableStatusTimestamp = (): number =>
  Math.floor(Date.now() / MILLISECONDS_IN_SECOND);

const normalizeAirtableStatus = (status: string): string => {
  const trimmed = status.trim();
  if (trimmed.length <= MAX_AIRTABLE_STATUS_LENGTH) {
    return trimmed;
  }
  return `${trimmed.slice(0, MAX_AIRTABLE_STATUS_LENGTH - 3)}...`;
};

export const getPublishedPoliticalEntityIDs = async ({
  airtableAPIKey,
}: {
  airtableAPIKey: string;
}) => {
  const db = new AirtableTs({ apiKey: airtableAPIKey });
  const politicalEntitiesTable = await db.table(PoliticalEntitiestable);

  const publishedEntities = await db.scan(PoliticalEntitiestable, {
    filterByFormula: formula(politicalEntitiesTable, [
      "AND",
      ["=", { field: "publishThisEntity" }, true],
    ]),
  });

  return new Set(publishedEntities.map((entity) => entity.id));
};

export const getUnprocessedDocuments = async ({
  airtableAPIKey,
}: {
  airtableAPIKey: string;
}) => {
  const db = new AirtableTs({ apiKey: airtableAPIKey });
  const documentsTable = await db.table(documentListTable);

  const unProcessedDocuments = await db.scan(documentListTable, {
    filterByFormula: formula(documentsTable, [
      "AND",
      ["=", { field: "processed" }, false],
    ]),
  });

  if (unProcessedDocuments.length === 0) {
    return unProcessedDocuments;
  }

  const publishedEntityIDs = await getPublishedPoliticalEntityIDs({
    airtableAPIKey,
  });

  // Documents linked only to unpublished entities stay unprocessed until
  // "Publish this Entity" is checked in Airtable. Documents with no entity
  // link pass through so the fetch task can flag them as failed.
  return unProcessedDocuments.filter((doc) => {
    const linkedEntityIDs = doc.politicalEntity ?? [];
    if (linkedEntityIDs.length === 0) {
      return true;
    }
    return linkedEntityIDs.some((entityID) => publishedEntityIDs.has(entityID));
  });
};

export const markDocumentAsProcessed = async ({
  airtableAPIKey,
  airtableID,
  status = "Processed",
}: {
  airtableAPIKey: string;
  airtableID: string;
  status?: string;
}) => {
  await updateDocumentStatus({
    airtableAPIKey,
    airtableID,
    status,
    processed: true,
  });
};

export const updateDocumentStatus = async ({
  airtableAPIKey,
  airtableID,
  status,
  processed,
}: {
  airtableAPIKey: string;
  airtableID: string;
  status: string;
  processed?: boolean;
}) => {
  const db = new AirtableTs({ apiKey: airtableAPIKey });
  await db.update(documentListTable, {
    id: airtableID,
    status: normalizeAirtableStatus(status),
    statusDate: getAirtableStatusTimestamp(),
    ...(typeof processed === "boolean" ? { processed } : {}),
  });
};

export const getAirtableCountries = async ({
  airtableAPIKey,
}: {
  airtableAPIKey: string;
  airtableID: string;
}) => {
  const db = new AirtableTs({ apiKey: airtableAPIKey });
  const countries = await db.scan(countriesTable, {});
  return countries;
};

export const getAirtablePoliticalEntities = async ({
  airtableAPIKey,
}: {
  airtableAPIKey: string;
  airtableID: string;
}) => {
  const db = new AirtableTs({ apiKey: airtableAPIKey });
  const entities = await db.scan(PoliticalEntitiestable, {});
  return entities;
};

export const updatePoliticalEntityStatus = async ({
  airtableAPIKey,
  airtableID,
  status,
}: {
  airtableAPIKey: string;
  airtableID: string;
  status: string | null;
}) => {
  const db = new AirtableTs({ apiKey: airtableAPIKey });
  await db.update(PoliticalEntitiestable, {
    id: airtableID,
    status,
  });
};

export const getDocumentsByIds = async ({
  airtableAPIKey,
  ids,
}: {
  airtableAPIKey: string;
  ids: string[];
}) => {
  if (!ids.length) {
    return [];
  }

  const db = new AirtableTs({ apiKey: airtableAPIKey });
  const documents = await db.scan(documentListTable, {});
  const idSet = new Set(ids);
  return documents.filter((doc) => idSet.has(doc.id));
};
