import type { Transport } from '@promisetracker/sdk'
import { createHttpTransport, createSdk, NotFoundError } from '@promisetracker/sdk'
import { afterEach, describe, expect, it, vi } from 'vitest'

const transportReturning = (value: unknown): Transport => ({ get: async () => value })

describe('sdk', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns site info that matches the contract', async () => {
    const sdk = createSdk(transportReturning({ name: 'PromiseTracker', tagline: null }))
    await expect(sdk.getSiteInfo()).resolves.toEqual({ name: 'PromiseTracker', tagline: null })
  })

  it('rejects a response that breaks the contract', async () => {
    const sdk = createSdk(transportReturning({ name: '', tagline: 3 }))
    await expect(sdk.getSiteInfo()).rejects.toThrow()
  })

  it('calls /api/v1 over HTTP and maps 404 to NotFoundError', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 404 }))
    vi.stubGlobal('fetch', fetchMock)
    const transport = createHttpTransport('https://example.org/')
    await expect(transport.get('/site', { lang: 'en' })).rejects.toBeInstanceOf(NotFoundError)
    expect(fetchMock).toHaveBeenCalledWith('https://example.org/api/v1/site?lang=en', {})
  })
})
