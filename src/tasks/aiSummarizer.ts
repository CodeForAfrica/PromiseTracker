import { TaskConfig } from 'payload'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'

export const AISummarizer: TaskConfig<'aiSummarizer'> = {
  slug: 'aiSummarizer',
  label: 'AI Summarizer',
  inputSchema: [
    {
      name: 'docs',
      type: 'array',
      fields: [
        {
          name: 'id',
          type: 'text',
        },
      ],
    },
  ],
  handler: async ({ input, req }) => {
    const { docs } = input
    const { payload } = req
    const { logger } = payload
    try {
      const {
        ai: { model: defaultModel, apiKey },
      } = await payload.findGlobal({
        slug: 'settings',
      })

      const google = createGoogleGenerativeAI({
        apiKey: apiKey,
      })

      const model = google(defaultModel)

      const systemPrompt = `
    You are a helpful assistant that analyzes documents to extract campaign promises and provide structured summaries.
    Your task is to identify and categorize campaign promises, providing direct quotations as sources.
    `

      const prompt = `
    Analyze the following document and extract campaign promises with the following structure:

    **Requirements:**
    1. **Title**: Infer an appropriate title from the document content.
    2. **Promises**: For each promise identified, provide:
       - **Category**: The thematic category of the promise (e.g., "Economy," "Healthcare," "Infrastructure," "Education," "Social Policy," etc.)
       - **Summary**: A concise summarization of the promise in your own words
       - **Source**: Direct quotations from the text that support this promise. Include multiple quotes if the promise is mentioned in different parts of the document.

    **Guidelines:**
    - Only include specific, actionable pledges about future actions
    - Exclude political commentary, statements of fact, or general values
    - Source field must contain exact quotes from the document text
    - Each promise should have clear supporting evidence in the source quotes
    - Group similar promises under appropriate categories
    - Reply in the language the document is written in

    **Document:**
    
    `

      const { docs: documents } = await payload.find({
        collection: 'documents',
        where: {
          id: {
            in: docs?.map((doc) => doc.id),
          },
        },
      })

      const processedDocs = []

      for (const document of documents) {
        const { extractedText } = document

        const plainText = extractedText?.root.children
          .map((item) => {
            if (item.type === 'paragraph') {
              return (item.children as Array<any>)
                .map((child: any) => (child.type === 'text' ? child.text : ''))
                .join('')
            }
            return ''
          })
          .join('\n')

        try {
          const res = await generateObject({
            model,
            system: systemPrompt,
            prompt: `${prompt} ${plainText}`,
            schema: z.object({
              title: z
                .string()
                .describe(
                  'Inferred title from the document content, or the provided document title as fallback',
                ),
              promises: z.array(
                z.object({
                  category: z.string().describe('The thematic category of the promise'),
                  summary: z.string().describe('A concise summary of the promise'),
                  source: z
                    .array(z.string())
                    .describe('Array of direct quotations from the text that support this promise'),
                }),
              ),
            }),
            maxRetries: 5,
          })

          const { object } = res

          logger.info(object)

          const update = await payload.update({
            collection: 'documents',
            id: document.id,
            data: {
              aiTitle: object.title,
              aiExtraction: object.promises.map((promise) => ({
                category: promise.category,
                summary: promise.summary,
                source: promise.source.map((quote, index) => `${index + 1}: ${quote}\n`).join('\n'),
                uniqueId: randomUUID(),
              })),
            },
          })

          processedDocs.push({
            id: document.id,
            title: object.title,
            promises: object.promises,
          })
        } catch (error) {
          logger.error('Error generating AI Response::', { error })
        }
      }

      return {
        output: {
          docs: processedDocs,
        },
      }
    } catch (error) {
      logger.error('Error:', { error })
      return {
        output: {
          docs: [],
        },
      }
    }
  },
}
