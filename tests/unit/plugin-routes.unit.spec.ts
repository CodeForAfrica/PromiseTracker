import type { Dirent } from 'node:fs'
import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'

import { firstPartyPlugins } from '@promisetracker/cms/kernel'
import { describe, expect, it } from 'vitest'

/**
 * Plugin routes are files on disk under `/api/plugins/{slug}/`, listed in each
 * manifest (section 4.7). These must match both ways.
 */
const pluginsDir = path.resolve(
  import.meta.dirname,
  '../../apps/site/src/app/(payload)/api/plugins',
)

const routeFiles = (dir: string): string[] => {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry: Dirent) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return routeFiles(full)
    return entry.name === 'route.ts' ? [path.relative(pluginsDir, path.dirname(full))] : []
  })
}

describe('plugin routes on disk', () => {
  const declared = firstPartyPlugins.flatMap((p) =>
    (p.manifest.routes ?? []).map((r) => `${p.manifest.slug}/${r.path}`),
  )
  const onDisk = routeFiles(pluginsDir)

  it('has a route file for every route a manifest declares', () => {
    expect(declared.filter((r) => !onDisk.includes(r))).toEqual([])
  })

  it('declares every route file in a manifest', () => {
    expect(onDisk.filter((r) => !declared.includes(r))).toEqual([])
  })
})
