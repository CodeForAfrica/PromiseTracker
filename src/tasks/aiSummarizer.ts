import { TaskConfig } from 'payload'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText, generateObject } from 'ai'
import { z } from 'zod'
import { writeFileSync } from 'node:fs'

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

    const {
      ai: { model: defaultModel, apiKey },
    } = await payload.findGlobal({
      slug: 'settings',
    })
    logger.info(`model: ${defaultModel}, apiKey: ${apiKey}`)

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
      const { title, extractedText } = document

      // convert extractedText to plain text
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
      console.log({ plainText })

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
      })
      await writeFileSync(`${title}.json`, JSON.stringify(res, null, 2))

      const { object } = res

      logger.info(object)

      const update = await payload.update({
        collection: 'documents',
        id: document.id,
        data: {
          aiTitle: object.title,
          aiExtraction: object.promises.map((promise) => ({
            category: promise.category,
            summary: {
              root: {
                type: 'root',
                children: [
                  {
                    type: 'paragraph',
                    children: [
                      {
                        type: 'text',
                        text: promise.summary,
                      },
                    ],
                  },
                ],
              },
            },
            source: {
              root: {
                type: 'root',
                indent: 0,
                children: [
                  {
                    indent: 0,
                    type: 'list',
                    version: 1,
                    listType: 'number',
                    start: 1,
                    tag: 'ol',
                    children: promise.source.map((quote, index) => ({
                      indent: 0,
                      type: 'listitem',
                      version: 1,
                      value: index + 1,
                      children: [
                        {
                          type: 'text',
                          text: quote,
                        },
                      ],
                    })),
                  },
                ],
              },
            },
          })),
        },
      })

      processedDocs.push({
        id: document.id,
        title: object.title,
        promises: object.promises,
      })
    }

    return {
      output: {
        docs: processedDocs,
      },
    }
  },
}
