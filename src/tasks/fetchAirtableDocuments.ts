import { TaskConfig } from 'payload'
import { getUnprocessedDocuments } from '@/lib/airtable'

const LANGUAGE_MAP: Record<string, 'en' | 'fr' | 'es'> = {
  English: 'en',
  French: 'fr',
  Spanish: 'es',
}

export const FetchAirtableDocuments: TaskConfig<'fetchAirtableDocuments'> = {
  retries: 2,
  slug: 'fetchAirtableDocuments',
  label: 'Fetch Airtable Documents',
  outputSchema: [
    {
      name: 'docs',
      type: 'array',
      fields: [
        {
          name: 'id',
          type: 'text',
          required: true,
        },
      ],
    },
  ],
  handler: async ({ req }) => {
    const {
      airtable: { airtableAPIKey, airtableBaseID },
    } = await req.payload.findGlobal({
      slug: 'settings',
    })

    if (!airtableAPIKey || !airtableBaseID) {
      throw new Error('Airtable API key or Base ID not found in settings')
    }

    const unProcessedDocuments = await getUnprocessedDocuments({ airtableAPIKey })

    const { docs: existingDocs } = await req.payload.find({
      collection: 'documents',
      where: {
        airtableID: {
          in: unProcessedDocuments.map((doc) => doc.id),
        },
      },
    })

    const docsToCreate = unProcessedDocuments.filter(
      (doc) => !existingDocs.find((existing) => existing.airtableID === doc.id),
    )

    if (docsToCreate.length === 0) {
      return { output: { docs: [] } }
    }

    const createdDocs = await Promise.all(
      docsToCreate.map(async (doc) => {
        return req.payload.create({
          collection: 'documents',
          data: {
            title: doc.name || doc.id,
            politicalEntity: doc.politician,
            country: doc.country,
            region: doc.region,
            language: LANGUAGE_MAP[doc?.language || ''] || '',
            type: doc.type?.toLowerCase() as 'promise' | 'evidence',
            yearFrom: doc.yearFrom,
            yearTo: doc.yearTo,
            airtableID: doc.id,
            url: doc.document.length ? doc.document[0] : doc.uRL,
          },
        })
      }),
    )

    return {
      output: {
        docs: createdDocs.map((doc) => ({ id: doc.id })),
      },
    }
  },
}
