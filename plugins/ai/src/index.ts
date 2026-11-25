import type { AdapterContext } from '@promisetracker/kernel'
import { createLog, definePromiseTrackerPlugin } from '@promisetracker/kernel'
import { encryptedSecretField } from '@promisetracker/plugin-core'

import { Extractions } from './collections'
import { extractCandidatesTask } from './job'
import { llmProviders, selectedModel } from './providers'

/**
 * plugin-ai: finds candidate claims in documents (sections 6.1, 7.8 and 9.5).
 * It brings an LLM provider adapter per vendor, the extractions and their
 * review screen, and the `extractCandidates` job.
 */
export const aiPlugin = definePromiseTrackerPlugin({
  slug: 'ai',
  version: '0.1.0',
  order: 30,
  dependsOn: ['core'],
  collections: [Extractions],
  tasks: [extractCandidatesTask as never],
  provides: { llm: llmProviders },
  // Which extraction and candidate an accepted claim came from (section 9.5).
  extend: [
    {
      collection: 'claims',
      fields: [
        { name: 'extraction', type: 'relationship', relationTo: 'extractions' },
        { name: 'candidate', type: 'text' },
      ],
    },
    {
      collection: 'documents',
      fields: [
        {
          name: 'findClaims',
          type: 'ui',
          admin: { components: { Field: '@promisetracker/plugin-ai/client#FindClaims' } },
        },
      ],
    },
  ],
  settings: [
    encryptedSecretField({
      name: 'apiKey',
      label: 'API key',
      admin: {
        description:
          'The key for the vendor PT_LLM_MODEL names, such as Google for google:gemini-2.5-pro. Stored encrypted and shown masked. Ollama needs none.',
      },
    }),
    encryptedSecretField({
      name: 'baseUrl',
      label: 'Address',
      admin: {
        description:
          'Only for Ollama, or a proxy in front of the vendor, such as http://ollama:11434. Leave empty to use the vendor’s own.',
      },
      validate: (value: unknown) => {
        if (value === null || value === undefined || value === '') return true
        try {
          const { protocol } = new URL(String(value))
          return (
            protocol === 'http:' || protocol === 'https:' || 'Use an http:// or https:// address.'
          )
        } catch {
          return 'This is not an address.'
        }
      },
    }),
  ],
  /**
   * The small test request at start-up (section 6.1). Exhausted credit or a
   * missing key is a degraded state, not a reason to stop: the rest of the
   * platform works, and a super-admin may set the key after start-up.
   */
  checkSettings: async (ctx: AdapterContext) => {
    const choice = selectedModel()
    const adapter = llmProviders.find((p) => p.id === choice?.vendor)
    if (!adapter) return
    const report = await adapter.health(ctx)
    const log = createLog(ctx.logger, 'ai')
    if (report.healthy) log.info('The AI model answered its test request', { model: choice?.model })
    else log.warn('The AI model failed its test request', { reason: report.detail })
  },
})

export * from './collections'
export * from './extract'
export * from './job'
export * from './providers'
