import { definePromiseTrackerPlugin } from '@promisetracker/kernel'
import { encryptedSecretField } from '@promisetracker/plugin-core'

import { tikaExtractor } from './extractor'

/** plugin-tika: reads PDF, Word, Excel and other office formats through Apache Tika (section 6.2). */
export const tikaPlugin = definePromiseTrackerPlugin({
  slug: 'tika',
  version: '0.1.0',
  order: 20,
  dependsOn: ['core'],
  provides: { contentExtractor: [tikaExtractor] },
  settings: [
    encryptedSecretField({
      name: 'url',
      label: 'Tika server address',
      admin: {
        description:
          'Where the Tika server listens, such as http://tika:9998. Stored encrypted and shown masked.',
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
})

export * from './extractor'
