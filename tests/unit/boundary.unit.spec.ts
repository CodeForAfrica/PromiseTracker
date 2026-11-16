import { readFileSync } from 'node:fs'
import path from 'node:path'

import { Biome } from '@biomejs/js-api/nodejs'
import { beforeAll, describe, expect, it } from 'vitest'

/**
 * The site may reach the platform only through the SDK (system specification,
 * section 10.1). These tests run the repository's Biome configuration against
 * sample imports in different parts of the site.
 */
const root = path.resolve(import.meta.dirname, '../..')
const forbidden = [
  'payload',
  '@payload-config',
  '@payloadcms/next/views',
  '@promisetracker/cms',
  '@promisetracker/plugin-core',
  '../../../../cms/src/getPayload',
]

let biome: Biome
let projectKey: number

const restrictedImports = (filePath: string, specifier: string): number => {
  const content = `import { x } from '${specifier}'\n\nexport const y = x\n`
  // Biome matches override globs against paths relative to the project root.
  const { diagnostics } = biome.lintContent(projectKey, content, { filePath })
  return diagnostics.filter((d) => d.category === 'lint/style/noRestrictedImports').length
}

beforeAll(() => {
  biome = new Biome()
  projectKey = biome.openProject(root).projectKey
  biome.applyConfiguration(
    projectKey,
    JSON.parse(readFileSync(path.join(root, 'biome.json'), 'utf8')),
  )
})

describe('site boundary', () => {
  it.each(forbidden)('blocks %s in site pages', (specifier) => {
    expect(restrictedImports('apps/site/src/app/(site)/probe.tsx', specifier)).toBe(1)
  })

  it.each(forbidden)('blocks %s in other site code', (specifier) => {
    expect(restrictedImports('apps/site/src/components/probe.ts', specifier)).toBe(1)
  })

  it('allows the SDK, the contract and the UI package in site pages', () => {
    for (const specifier of [
      '@promisetracker/sdk',
      '@promisetracker/contract',
      '@promisetracker/ui',
    ]) {
      expect(restrictedImports('apps/site/src/app/(site)/probe.tsx', specifier)).toBe(0)
    }
  })

  it('allows the platform in the seam and the Payload mount', () => {
    for (const file of [
      'apps/site/src/platform/probe.ts',
      'apps/site/src/app/(payload)/probe.ts',
    ]) {
      expect(restrictedImports(file, '@promisetracker/cms')).toBe(0)
      expect(restrictedImports(file, 'payload')).toBe(0)
    }
  })
})
