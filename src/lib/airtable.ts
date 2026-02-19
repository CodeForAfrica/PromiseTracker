import { AirtableTs } from "airtable-ts";
import {
  documentsTable as documentListTable,
  countriesTable,
  PoliticalEntitiestable,
} from "@/types/airtableSchema";
import { formula } from "airtable-ts-formula";

export const getUnprocessedDocuments = async ({
  airtableAPIKey,
}: {
  airtableAPIKey: string;
}) => {
  const db = new AirtableTs({ apiKey: airtableAPIKey });
  const documentsTable = await db.table(documentListTable);

  const unProcessedDocuments = await db.scan(documentListTable, {
    // @ts-expect-error: Type 'string | string[]' is not assignable to type 'string'.
    filterByFormula: formula(documentsTable, [
      "AND",
      ["=", { field: "processed" }, false],
    ]),
  });

  return unProcessedDocuments;
};

export const markDocumentAsProcessed = async ({
  airtableAPIKey,
  airtableID,
}: {
  airtableAPIKey: string;
  airtableID: string;
}) => {
  const db = new AirtableTs({ apiKey: airtableAPIKey });
  await db.update(documentListTable, {
    id: airtableID,
    processed: true,
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
