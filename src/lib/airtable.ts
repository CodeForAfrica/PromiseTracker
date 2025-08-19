import { AirtableTs } from 'airtable-ts'
import { documentListTable } from '@/types/airtableSchema'
import { formula } from 'airtable-ts-formula'

export const getUnprocessedDocuments = async ({ airtableAPIKey }: { airtableAPIKey: string }) => {
  const db = new AirtableTs({ apiKey: airtableAPIKey })
  const documentsTable = await db.table(documentListTable)

  const unProcessedDocuments = await db.scan(documentListTable, {
    // @ts-expect-error: Type 'string | string[]' is not assignable to type 'string'.
    filterByFormula: formula(documentsTable, ['AND', ['=', { field: 'processed' }, false]]),
  })

  return unProcessedDocuments
}

export const markDocumentAsProcessed = async ({
  airtableAPIKey,
  airtableID,
}: {
  airtableAPIKey: string
  airtableID: string
}) => {
  const db = new AirtableTs({ apiKey: airtableAPIKey })
  await db.update(documentListTable, {
    id: airtableID,
    processed: true,
  })
}
