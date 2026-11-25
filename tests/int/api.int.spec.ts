import { getPayload, handleV1, READ_CACHE, respondV1, V1_PATTERNS } from '@promisetracker/cms'
import { ApiError, V1_ENDPOINTS } from '@promisetracker/contract'
import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * What every `/api/v1` endpoint shares (section 12.2): query parameters
 * checked against the contract, `Cache-Control` and `ETag` on reads, `304`
 * for an unchanged body, and the OpenAPI description. The responses of each
 * endpoint are checked against the contract in seed.int.spec.ts, on seeded
 * records, over both transports.
 */
describe('/api/v1', () => {
  let payload: Payload

  const get = (path: string, headers: Record<string, string> = {}) =>
    respondV1(
      new Request(`http://promisetracker.test/api/v1${path}`, { headers }),
      path.split('?')[0] ?? path,
      getPayload,
    )

  const errorOf = async (path: string) => {
    const response = await get(path)
    expect(response.status, path).toBe(400)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.get('ETag')).toBeNull()
    return ApiError.parse(await response.json()).error
  }

  beforeAll(async () => {
    payload = await getPayload()
  })

  afterAll(async () => {
    await payload.destroy()
  })

  describe('the routes and the contract', () => {
    it('answer the same paths', () => {
      const contract = V1_ENDPOINTS.map((e) => e.path.replace(/\{(\w+)\}/g, ':$1')).sort()
      expect([...V1_PATTERNS].sort()).toEqual(contract)
    })
  })

  describe('query parameters (section 12.2)', () => {
    it('refuses a parameter the endpoint does not take', async () => {
      expect(await errorOf('/countries?locale=en&page=2')).toBe(
        'This endpoint takes no page parameter.',
      )
      expect(await errorOf('/countries/ke/offices?locale=en&kind=person')).toBe(
        'This endpoint takes no kind parameter.',
      )
    })

    it('refuses a value of the wrong form, naming the parameter', async () => {
      for (const [query, param] of [
        ['kind=robot', 'kind'],
        ['stage=candidate', 'stage'],
        ['sort=age', 'sort'],
        ['limit=0', 'limit'],
        ['limit=101', 'limit'],
        ['limit=ten', 'limit'],
        ['cursor=-1', 'cursor'],
        ['office=Not%20A%20Slug', 'office'],
      ] as const) {
        expect(await errorOf(`/countries/ke/actors?locale=en&${query}`)).toBe(
          `The ${param} parameter is not one this endpoint accepts.`,
        )
      }
      expect(await errorOf('/countries/ke/claims?locale=en&sort=popular')).toMatch(/sort/)
      expect(await errorOf('/countries/ke/areas?locale=en&parent=..')).toMatch(/parent/)
      expect(await errorOf('/redirects?locale=en&path=ke')).toMatch(/path/)
    })

    it('refuses a parameter given twice', async () => {
      expect(await errorOf('/countries/ke/actors?locale=en&kind=person&kind=party')).toBe(
        'The kind parameter is given more than once.',
      )
    })

    it('needs a language the site runs in', async () => {
      for (const query of ['', '?locale=', '?locale=de']) {
        expect(await errorOf(`/site${query}`)).toMatch(/^The locale parameter must be one of en/)
      }
    })

    it('reaches the handler once the query is right', async () => {
      const result = await handleV1(payload, '/countries', new URLSearchParams({ locale: 'en' }))
      expect(result?.status).toBe(200)
    })
  })

  describe('caching (section 12.2)', () => {
    it('sends Cache-Control and an ETag with a read', async () => {
      const response = await get('/site?locale=en')
      expect(response.status).toBe(200)
      expect(response.headers.get('Cache-Control')).toBe(READ_CACHE)
      expect(response.headers.get('ETag')).toMatch(/^"[\w-]{27}"$/)
      expect(response.headers.get('Content-Type')).toBe('application/json')
    })

    it('answers 304 with no body when the ETag still matches', async () => {
      const first = await get('/site?locale=en')
      const etag = first.headers.get('ETag') ?? ''
      for (const ifNoneMatch of [etag, `W/${etag}`, `"other", ${etag}`, '*']) {
        const again = await get('/site?locale=en', { 'If-None-Match': ifNoneMatch })
        expect(again.status, ifNoneMatch).toBe(304)
        expect(await again.text()).toBe('')
        expect(again.headers.get('ETag')).toBe(etag)
        expect(again.headers.get('Cache-Control')).toBe(READ_CACHE)
      }
      const stale = await get('/site?locale=en', { 'If-None-Match': '"something-else"' })
      expect(stale.status).toBe(200)
    })

    it('gives each language its own ETag', async () => {
      const en = (await get('/site?locale=en')).headers.get('ETag')
      const fr = (await get('/site?locale=fr')).headers.get('ETag')
      expect(en).not.toBe(fr)
    })

    it('keeps a "not found" out of caches', async () => {
      const response = await get('/nothing-here?locale=en')
      expect(response.status).toBe(404)
      expect(response.headers.get('Cache-Control')).toBe('no-store')
      expect(ApiError.parse(await response.json())).toEqual({ error: 'not-found' })
      const unknownCountry = await get('/countries/zz?locale=en')
      expect(unknownCountry.status).toBe(404)
    })

    it('never answers 304 for a record that is missing or not available', async () => {
      const missing = await get('/countries/zz?locale=en')
      const etag = missing.headers.get('ETag') ?? ''
      for (const ifNoneMatch of ['*', etag]) {
        const again = await get('/countries/zz?locale=en', { 'If-None-Match': ifNoneMatch })
        expect(again.status, ifNoneMatch).toBe(404)
        expect(ApiError.parse(await again.json()).error).toBeTruthy()
      }
    })

    it('answers 304 for the OpenAPI description, whose ETag stays the same', async () => {
      const etag = (await get('/openapi.json')).headers.get('ETag') ?? ''
      expect((await get('/openapi.json')).headers.get('ETag')).toBe(etag)
      expect((await get('/openapi.json', { 'If-None-Match': etag })).status).toBe(304)
    })
  })

  describe('the OpenAPI description (section 12.2)', () => {
    // It needs no language: it describes the API in every language at once.
    it('is served at /api/v1/openapi.json, built from the contract, with an ETag', async () => {
      const response = await get('/openapi.json')
      expect(response.status).toBe(200)
      expect(response.headers.get('ETag')).toBeTruthy()
      const doc = (await response.json()) as {
        openapi: string
        paths: Record<string, unknown>
        components: { schemas: Record<string, unknown> }
      }
      expect(doc.openapi).toBe('3.1.0')
      expect(Object.keys(doc.paths)).toEqual(V1_ENDPOINTS.map((e) => e.path))
      expect(doc.components.schemas.NotAvailable).toBeTruthy()
    })
  })
})
