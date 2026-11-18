import type { Transport } from '@promisetracker/sdk'
import { BadRequestError, createHttpTransport, createSdk, NotFoundError } from '@promisetracker/sdk'
import { afterEach, describe, expect, it, vi } from 'vitest'

const answering = (status: number, body: unknown): Transport => ({
  get: async () => ({ status, body }),
})

const country = {
  code: 'ke',
  name: 'Kenya',
  region: null,
  about: null,
  defaultLanguage: 'en',
  counts: { currentHolders: 0, pastTerms: 0 },
}

describe('sdk', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns a country that matches the contract', async () => {
    await expect(createSdk(answering(200, country)).getCountry('en', 'ke')).resolves.toEqual(
      country,
    )
  })

  it('rejects a response that breaks the contract', async () => {
    await expect(
      createSdk(answering(200, { ...country, code: 'kenya' })).getCountry('en', 'ke'),
    ).rejects.toThrow()
  })

  it('returns "not available" as a result, with the languages it is in', async () => {
    const body = {
      error: 'not-available',
      availableIn: [{ code: 'en', label: 'English', rtl: false }],
    }
    await expect(createSdk(answering(404, body)).getCountry('fr', 'ke')).resolves.toEqual(body)
  })

  it('throws NotFoundError for any other 404, and BadRequestError for a 400', async () => {
    await expect(
      createSdk(answering(404, { error: 'not-found' })).getCountry('en', 'zz'),
    ).rejects.toBeInstanceOf(NotFoundError)
    await expect(
      createSdk(answering(400, { error: 'bad locale' })).getSiteInfo('xx'),
    ).rejects.toBeInstanceOf(BadRequestError)
  })

  it('calls /api/v1 over HTTP with the locale, and passes the status on', async () => {
    const fetchMock = vi.fn(async () => Response.json({ error: 'not-found' }, { status: 404 }))
    vi.stubGlobal('fetch', fetchMock)
    const transport = createHttpTransport('https://example.org/')
    await expect(transport.get('/countries/ke', { locale: 'en' })).resolves.toEqual({
      status: 404,
      body: { error: 'not-found' },
    })
    expect(fetchMock).toHaveBeenCalledWith('https://example.org/api/v1/countries/ke?locale=en', {})
  })
})
