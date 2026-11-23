import { readFileSync } from 'node:fs'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { NOINDEX, noindexFrom } from '../../apps/site/src/noindex'
import { config, proxy } from '../../apps/site/src/proxy'

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

describe('PT_NOINDEX', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('reads the usual ways of saying yes', () => {
    for (const yes of ['true', 'TRUE', '1', 'yes', 'on', ' true '])
      expect(noindexFrom(yes)).toBe(true)
    for (const no of [undefined, '', 'false', '0', 'no', 'off', 'maybe']) {
      expect(noindexFrom(no)).toBe(false)
    }
  })

  it('tells search engines not to index the server when set', () => {
    vi.stubEnv('PT_NOINDEX', 'true')
    expect(proxy().headers.get('X-Robots-Tag')).toBe(NOINDEX)
  })

  it('adds nothing when unset, as in production', () => {
    vi.stubEnv('PT_NOINDEX', '')
    expect(proxy().headers.get('X-Robots-Tag')).toBeNull()
  })

  it('covers pages and the admin, but not the API or built files', () => {
    // This matcher is also a valid regular expression, read the same way.
    const matcher = new RegExp(`^${config.matcher[0]}$`)
    for (const path of ['/', '/en/ke', '/admin', '/admin/collections/documents', '/robots.txt']) {
      expect(matcher.test(path), path).toBe(true)
    }
    // Uploads go to the API. Next.js would cut any body the proxy sees at 10 MB.
    for (const path of [
      '/api/media',
      '/api/v1/countries',
      '/_next/static/chunks/a.js',
      '/_next/image',
    ]) {
      expect(matcher.test(path), path).toBe(false)
    }
  })
})

describe('the image on Dokku', () => {
  it('runs a web process and a worker', () => {
    expect(read('docker/Procfile').trim().split('\n')).toEqual(['web: web', 'worker: worker'])
  })

  it('takes traffic only once the readiness check passes', () => {
    const app = JSON.parse(read('docker/app.json')) as {
      healthchecks: { web: { type: string; path: string }[] }
    }
    expect(app.healthchecks.web).toContainEqual(
      expect.objectContaining({ type: 'startup', path: '/api/health/ready' }),
    )
  })

  it('ships both files in the working folder, where Dokku reads them', () => {
    expect(read('docker/Dockerfile')).toMatch(/^COPY docker\/Procfile docker\/app\.json \.\/$/m)
  })
})
