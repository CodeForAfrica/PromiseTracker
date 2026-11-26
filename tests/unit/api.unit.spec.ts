import {
  ActorsQuery,
  AreasQuery,
  ClaimsQuery,
  LocaleQuery,
  openApiDocument,
  PAGE_LIMIT,
  RedirectQuery,
  V1_ENDPOINTS,
  V1_POSTS,
} from '@promisetracker/contract'
import { describe, expect, it } from 'vitest'

/**
 * The contract's side of section 12.2: the query each endpoint takes and the
 * OpenAPI description built from it. The server's use of both is tested in
 * tests/int/api.int.spec.ts.
 */

type Operation = {
  parameters: { name: string; in: string; required: boolean; schema: Record<string, unknown> }[]
  responses: Record<string, { content?: { 'application/json': { schema: unknown } } }>
}
type Document = {
  openapi: string
  paths: Record<string, { get: Operation }>
  components: { schemas: Record<string, unknown> }
}

describe('query schemas', () => {
  it('need a locale on every endpoint, and take nothing they do not list', () => {
    for (const endpoint of V1_ENDPOINTS) {
      expect(endpoint.query.safeParse({}).success, endpoint.path).toBe(false)
      expect(endpoint.query.safeParse({ locale: 'en', extra: '1' }).success, endpoint.path).toBe(
        false,
      )
    }
    expect(LocaleQuery.parse({ locale: 'en' })).toEqual({ locale: 'en' })
  })

  it('read paging as an offset cursor and a bounded limit', () => {
    expect(ActorsQuery.parse({ locale: 'en', cursor: '50', limit: '25' })).toMatchObject({
      cursor: '50',
      limit: 25,
    })
    for (const limit of ['0', String(PAGE_LIMIT.max + 1), '2.5', 'ten']) {
      expect(ClaimsQuery.safeParse({ locale: 'en', limit }).success, limit).toBe(false)
    }
    expect(ClaimsQuery.safeParse({ locale: 'en', cursor: 'abc' }).success).toBe(false)
  })

  it('take filters as slugs and the listed values only', () => {
    expect(ActorsQuery.safeParse({ locale: 'en', kind: 'party', office: 'governor' }).success).toBe(
      true,
    )
    expect(ActorsQuery.safeParse({ locale: 'en', office: 'Governor' }).success).toBe(false)
    expect(ActorsQuery.safeParse({ locale: 'en', stage: 'candidate' }).success).toBe(false)
    expect(AreasQuery.safeParse({ locale: 'en', parent: 'nairobi-county' }).success).toBe(true)
    expect(RedirectQuery.safeParse({ locale: 'en', path: '/ke/president' }).success).toBe(true)
    expect(RedirectQuery.safeParse({ locale: 'en' }).success).toBe(false)
  })
})

describe('the OpenAPI description', () => {
  const doc = openApiDocument() as Document

  it('is OpenAPI 3.1 with one path per endpoint, in the contract’s order, then the forms', () => {
    expect(doc.openapi).toBe('3.1.0')
    expect(Object.keys(doc.paths)).toEqual([
      ...V1_ENDPOINTS.map((e) => e.path),
      ...V1_POSTS.map((e) => e.path),
    ])
    // The forms are POSTs, with their bodies described.
    for (const post of V1_POSTS) {
      const entry = (doc.paths as Record<string, { post?: { requestBody?: unknown } }>)[post.path]
      expect(entry?.post?.requestBody, post.path).toBeDefined()
    }
  })

  it('lists each path parameter, and each query parameter from the contract', () => {
    for (const endpoint of V1_ENDPOINTS) {
      const { parameters } = doc.paths[endpoint.path]?.get ?? { parameters: [] }
      const inPath = parameters.filter((p) => p.in === 'path').map((p) => p.name)
      expect(inPath).toEqual([...endpoint.path.matchAll(/\{(\w+)\}/g)].map(([, name]) => name))
      const inQuery = parameters.filter((p) => p.in === 'query').map((p) => p.name)
      expect(inQuery).toEqual(Object.keys(endpoint.query.shape))
      expect(parameters.find((p) => p.name === 'locale')?.required).toBe(true)
    }
    const actors = doc.paths['/countries/{code}/actors']?.get.parameters ?? []
    expect(actors.find((p) => p.name === 'limit')?.schema).toMatchObject({
      type: 'integer',
      maximum: PAGE_LIMIT.max,
    })
    expect(actors.find((p) => p.name === 'kind')?.schema).toMatchObject({
      enum: ['person', 'party', 'institution'],
    })
  })

  it('describes 200, 304, 400 and 404, and every schema it refers to exists', () => {
    const refs = JSON.stringify(doc.paths).match(/#\/components\/schemas\/\w+/g) ?? []
    for (const ref of new Set(refs)) {
      expect(doc.components.schemas[ref.split('/').at(-1) ?? ''], ref).toBeTruthy()
    }
    for (const endpoint of V1_ENDPOINTS) {
      const responses = doc.paths[endpoint.path]?.get.responses ?? {}
      expect(Object.keys(responses), endpoint.path).toEqual(['200', '304', '400', '404'])
      const notFound = JSON.stringify(responses['404'])
      expect(notFound.includes('NotAvailable'), endpoint.path).toBe(endpoint.notAvailable)
    }
  })
})
