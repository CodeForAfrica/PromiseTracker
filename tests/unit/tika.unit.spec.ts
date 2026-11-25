import { pluginServices } from '@promisetracker/cms/health'
import type { AdapterContext } from '@promisetracker/kernel'
import {
  ConfigurationError,
  createKernel,
  ExternalServiceError,
  ValidationError,
} from '@promisetracker/kernel'
import {
  corePlugin,
  ENCRYPTED_PREFIX,
  encryptedSecretField,
  isEncrypted,
  SECRET_MASK,
} from '@promisetracker/plugin-core'
import { sitePlugin } from '@promisetracker/plugin-site'
import {
  HEALTH_TIMEOUT_MS,
  readTikaAnswer,
  TIKA_TYPES,
  tikaExtractor,
  tikaPlugin,
  tikaUrl,
} from '@promisetracker/plugin-tika'
import type { FieldHook, Payload } from 'payload'
import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * plugin-tika's pure parts (sections 6.2, 9.3 and 16.3): its address, how it
 * reads Tika's answer and failures, its health, and the encrypted field that
 * holds the address (section 13.7). The integration tests run the real Tika.
 */

const ctx = (settings: Record<string, unknown> = { url: 'http://tika:9998/' }): AdapterContext => ({
  payload: {} as Payload,
  logger: {} as AdapterContext['logger'],
  signal: new AbortController().signal,
  settings,
})

const content = {
  filename: 'manifeste.pdf',
  mimeType: 'application/pdf',
  data: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
}

afterEach(() => vi.unstubAllGlobals())

describe('the Tika address', () => {
  it('comes from the settings, without trailing slashes', () => {
    expect(tikaUrl({ url: ' http://tika:9998// ' })).toBe('http://tika:9998')
  })

  it('says where to set it when it is missing', () => {
    for (const settings of [{}, { url: '' }, { url: '   ' }, { url: 42 }]) {
      expect(() => tikaUrl(settings)).toThrow(ConfigurationError)
    }
    expect(() => tikaUrl({})).toThrow(/Administration > Settings > Tika/)
  })

  it('refuses the mask a person reads, rather than calling an address that is not one', () => {
    expect(() => tikaUrl({ url: SECRET_MASK })).toThrow(ConfigurationError)
    expect(() => tikaUrl({ url: SECRET_MASK })).toThrow(/masked/)
  })
})

describe('the formats it reads', () => {
  it('covers PDF, Word, Excel, PowerPoint, OpenDocument, RTF and EPUB, not plain text', () => {
    expect(tikaExtractor.accepts).toEqual(TIKA_TYPES)
    expect(TIKA_TYPES).toEqual(
      expect.arrayContaining([
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.oasis.opendocument.text',
        'application/rtf',
        'application/epub+zip',
      ]),
    )
    for (const type of ['text/plain', 'text/html', 'text/csv', 'text/markdown']) {
      expect(TIKA_TYPES).not.toContain(type)
    }
  })

  it('is provided by the plugin, which keeps its address in settings', () => {
    expect(tikaPlugin.manifest.provides?.contentExtractor).toEqual([tikaExtractor])
    expect(tikaPlugin.manifest.settings?.map((f) => ('name' in f ? f.name : ''))).toEqual(['url'])
  })
})

describe("reading Tika's answer", () => {
  it('joins the file and its embedded parts, tidies blank lines and keeps every character', () => {
    const answer = readTikaAnswer([
      {
        'Content-Type': 'application/pdf',
        'xmpTPg:NPages': '2',
        'X-TIKA:content': '\n\n\nLe gouvernement s’engage à créer des écoles.  \n\n\n\nŒuvre.\n',
      },
      { 'X-TIKA:content': 'Annexe : santé.' },
      { 'X-TIKA:content': 7 },
    ])
    expect(answer.text).toBe(
      'Le gouvernement s’engage à créer des écoles.\n\nŒuvre.\n\nAnnexe : santé.',
    )
    expect(answer.pageCount).toBe(2)
    expect(answer.metadata).toEqual({ contentType: 'application/pdf', parts: 3 })
  })

  it('reads a Word page count, and has none when Tika gives none', () => {
    expect(readTikaAnswer([{ 'meta:page-count': ['3'], 'X-TIKA:content': 'a' }]).pageCount).toBe(3)
    expect(readTikaAnswer([{ 'X-TIKA:content': 'a' }]).pageCount).toBeNull()
    expect(
      readTikaAnswer([{ 'xmpTPg:NPages': 'many', 'X-TIKA:content': 'a' }]).pageCount,
    ).toBeNull()
  })

  it('fails without retrying when the file is damaged or locked', () => {
    const damaged = () =>
      readTikaAnswer([
        { 'X-TIKA:EXCEPTION:container_exception': 'java.io.IOException: Missing root' },
      ])
    expect(damaged).toThrow(ValidationError)
    expect(damaged).toThrow(/may be damaged/)
    expect(() =>
      readTikaAnswer([{ 'X-TIKA:EXCEPTION:container_exception': 'EncryptedDocumentException' }]),
    ).toThrow(/protected by a password/)
  })

  it('keeps what it read when only part of the file failed', () => {
    const answer = readTikaAnswer([
      { 'X-TIKA:EXCEPTION:container_exception': 'IOException', 'X-TIKA:content': 'Page un.' },
    ])
    expect(answer.text).toBe('Page un.')
  })

  it('treats anything but a list of parts as a broken answer', () => {
    for (const answer of [null, {}, []]) {
      expect(() => readTikaAnswer(answer)).toThrow(ExternalServiceError)
    }
  })
})

describe('the tika extractor', () => {
  const answering = (body: BodyInit | null, init: ResponseInit = {}) => {
    const fetch = vi.fn(async () => new Response(body, init))
    vi.stubGlobal('fetch', fetch)
    return fetch
  }

  it('sends the file with its type and the pipeline’s signal, and reads the text', async () => {
    const fetch = answering(JSON.stringify([{ 'X-TIKA:content': 'Bonjour à tous.' }]), {
      headers: { 'content-type': 'application/json' },
    })
    const context = ctx()
    const result = await tikaExtractor.extract(content, context)
    expect(result.text).toBe('Bonjour à tous.')
    expect(fetch).toHaveBeenCalledWith('http://tika:9998/rmeta/text', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/pdf', Accept: 'application/json' },
      body: content.data,
      signal: context.signal,
    })
  })

  it('fails at once on a type Tika refuses or a file it cannot parse', async () => {
    for (const status of [415, 422]) {
      answering('Unprocessable', { status })
      await expect(tikaExtractor.extract(content, ctx())).rejects.toThrow(ValidationError)
    }
  })

  it('retries when Tika is down or busy, and names no address', async () => {
    answering('down', { status: 503 })
    const down = tikaExtractor.extract(content, ctx())
    await expect(down).rejects.toMatchObject({ retryable: true, service: 'tika' })
    await expect(down).rejects.not.toThrow(/tika:9998/)

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed')
      }),
    )
    const unreachable = tikaExtractor.extract(content, ctx())
    await expect(unreachable).rejects.toMatchObject({ retryable: true, failure: 'unavailable' })
    await expect(unreachable).rejects.toThrow('tika could not be reached.')
  })

  it('treats an answer that is not JSON as a broken answer', async () => {
    answering('<html>', { status: 200 })
    await expect(tikaExtractor.extract(content, ctx())).rejects.toMatchObject({
      failure: 'invalid-response',
      retryable: false,
    })
  })

  it('retries when the connection drops part way through the answer', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('[{"X-TIKA:content":"Bonj'))
        controller.error(new TypeError('terminated'))
      },
    })
    answering(body, { status: 200 })
    await expect(tikaExtractor.extract(content, ctx())).rejects.toMatchObject({
      retryable: true,
      service: 'tika',
    })
  })

  it('fails at once when no address is set', async () => {
    await expect(tikaExtractor.extract(content, ctx({}))).rejects.toThrow(ConfigurationError)
  })
})

describe("the tika extractor's health", () => {
  it('asks for the version, within a few seconds', async () => {
    const fetch = vi.fn(async () => new Response('Apache Tika 3.2.3\n'))
    vi.stubGlobal('fetch', fetch)
    await expect(tikaExtractor.health(ctx())).resolves.toEqual({
      healthy: true,
      detail: 'Apache Tika 3.2.3',
    })
    expect(fetch).toHaveBeenCalledWith('http://tika:9998/version', expect.any(Object))
    expect(HEALTH_TIMEOUT_MS).toBeLessThanOrEqual(5_000)
  })

  it('is unhealthy when Tika errs, cannot be reached, or has no address', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 500 })),
    )
    await expect(tikaExtractor.health(ctx())).resolves.toEqual({
      healthy: false,
      detail: 'HTTP 500',
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed')
      }),
    )
    await expect(tikaExtractor.health(ctx())).resolves.toEqual({
      healthy: false,
      detail: 'tika could not be reached.',
    })
    await expect(tikaExtractor.health(ctx({}))).resolves.toMatchObject({
      healthy: false,
      detail: expect.stringMatching(/not set/),
    })
  })
})

describe('the health report (section 16.3)', () => {
  const payload = { config: { globals: [] } } as unknown as Payload

  it('lists Tika when plugin-tika is enabled', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('Apache Tika 3.2.3')),
    )
    const kernel = createKernel({
      plugins: [corePlugin, sitePlugin, tikaPlugin],
      env: { PT_PLUGINS: 'core,site,tika' },
    })
    const services = await pluginServices(payload, kernel)
    // No settings global in this stand-in Payload, so no address.
    expect(services.tika).toMatchObject({ healthy: false, kind: 'tika', error: expect.any(String) })
    expect(Object.keys(services)).toEqual(['tika'])
  })

  it('reports a plugin whose settings cannot be read as down, and still answers', async () => {
    const kernel = createKernel({
      plugins: [corePlugin, sitePlugin, tikaPlugin],
      env: { PT_PLUGINS: 'core,site,tika' },
    })
    const broken = {
      ...kernel,
      context: async () => {
        throw new Error('relation "settings" does not exist')
      },
    }
    const services = await pluginServices(payload, broken)
    expect(services.tika).toMatchObject({ healthy: false, kind: 'tika', error: 'Error' })
  })

  it('never names the configured address (section 13.7)', async () => {
    const kernel = createKernel({
      plugins: [corePlugin, sitePlugin, tikaPlugin],
      env: { PT_PLUGINS: 'core,site,tika' },
    })
    const url = 'http://tika-secret.internal:9998'
    const withAddress = {
      ...kernel,
      context: async () => ({ ...ctx({ url }) }),
    }
    for (const answer of [
      async () => new Response('', { status: 500 }),
      async () => {
        throw new TypeError(`fetch failed: ${url}`)
      },
    ]) {
      vi.stubGlobal('fetch', vi.fn(answer))
      const services = await pluginServices(payload, withAddress)
      expect(services.tika?.healthy).toBe(false)
      expect(JSON.stringify(services)).not.toContain('tika-secret')
    }
  })

  it('leaves Tika out when plugin-tika is disabled', async () => {
    const kernel = createKernel({
      plugins: [corePlugin, sitePlugin, tikaPlugin],
      env: { PT_PLUGINS: 'core,site' },
    })
    await expect(pluginServices(payload, kernel)).resolves.toEqual({})
  })
})

describe('the encrypted settings field (section 13.7)', () => {
  const field = encryptedSecretField({ name: 'url' })
  const encrypt = vi.fn((text: string) => `cipher(${text})`)
  const decrypt = vi.fn((text: string) => text.replace(/^cipher\((.*)\)$/, '$1'))
  const req = (over: Record<string, unknown> = {}) => ({
    payload: { encrypt, decrypt },
    payloadAPI: 'local',
    user: null,
    ...over,
  })
  const run = (hook: FieldHook | undefined, args: Record<string, unknown>) =>
    hook?.(args as Parameters<FieldHook>[0])
  const beforeChange = field.hooks?.beforeChange?.at(-1)
  const afterRead = field.hooks?.afterRead?.at(-1)

  it('encrypts a new value once', async () => {
    await expect(run(beforeChange, { value: 'http://tika:9998', req: req() })).resolves.toBe(
      `${ENCRYPTED_PREFIX}cipher(http://tika:9998)`,
    )
    const stored = `${ENCRYPTED_PREFIX}cipher(x)`
    await expect(run(beforeChange, { value: stored, req: req() })).resolves.toBe(stored)
    expect(isEncrypted(stored)).toBe(true)
    expect(isEncrypted('http://tika:9998')).toBe(false)
  })

  it('keeps the stored value when the mask comes back, and lets it be cleared', async () => {
    const stored = `${ENCRYPTED_PREFIX}cipher(x)`
    await expect(
      run(beforeChange, { value: SECRET_MASK, previousValue: stored, req: req() }),
    ).resolves.toBe(stored)
    await expect(run(beforeChange, { value: '', req: req() })).resolves.toBe('')
    await expect(run(beforeChange, { value: null, req: req() })).resolves.toBeNull()
  })

  it('reads the stored value again when a person saves the mask back', async () => {
    // A person's save passes the value as they read it: the mask.
    const stored = `${ENCRYPTED_PREFIX}cipher(x)`
    const db = {
      findGlobal: vi.fn(async () => ({ tika: { url: stored } })),
      findOne: vi.fn(async () => ({ id: 'd1', key: stored })),
    }
    const withDb = req({ payload: { encrypt, decrypt, db } })
    const masked = { value: SECRET_MASK, previousValue: SECRET_MASK, req: withDb }
    await expect(
      run(beforeChange, { ...masked, global: { slug: 'settings' }, path: ['tika', 'url'] }),
    ).resolves.toBe(stored)
    await expect(
      run(beforeChange, {
        ...masked,
        collection: { slug: 'things' },
        originalDoc: { id: 'd1' },
        path: ['key'],
      }),
    ).resolves.toBe(stored)
    expect(db.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'things', where: { id: { equals: 'd1' } } }),
    )
    // Nothing stored yet: nothing to keep.
    await expect(run(beforeChange, { ...masked, path: ['key'] })).resolves.toBeNull()
  })

  it('decrypts only for the system, and masks it for people and other APIs', () => {
    const stored = `${ENCRYPTED_PREFIX}cipher(http://tika:9998)`
    expect(run(afterRead, { value: stored, req: req() })).toBe('http://tika:9998')
    expect(run(afterRead, { value: stored, req: req({ user: { id: 'u1' } }) })).toBe(SECRET_MASK)
    expect(run(afterRead, { value: stored, req: req({ payloadAPI: 'REST' }) })).toBe(SECRET_MASK)
    // A value saved before encryption is read as it is.
    expect(run(afterRead, { value: 'http://plain', req: req() })).toBe('http://plain')
    expect(run(afterRead, { value: '', req: req() })).toBe('')
  })

  it('is open to super-admins only', () => {
    const access = field.access?.read
    const as = (roles: string[]) => access?.({ req: { user: { roles } } } as never)
    expect(as(['super-admin'])).toBe(true)
    expect(as(['editor'])).toBe(false)
    expect(field.access?.update?.({ req: { user: null } } as never)).toBe(false)
  })

  it('does not check the mask again, and checks anything else', () => {
    const options = { req: { payload: { decrypt } } } as never
    const checked = encryptedSecretField({
      name: 'url',
      validate: (value: unknown) => value === 'ok' || 'Not ok.',
    })
    const validate = (value: string) => checked.validate?.(value as never, options)
    expect(validate(SECRET_MASK)).toBe(true)
    expect(validate('ok')).toBe(true)
    expect(validate('bad')).toBe('Not ok.')
    // Payload checks after the hooks, so a stored value is decrypted and checked.
    expect(validate(`${ENCRYPTED_PREFIX}cipher(ok)`)).toBe(true)
    expect(validate(`${ENCRYPTED_PREFIX}cipher(bad)`)).toBe('Not ok.')
  })

  it('checks an address in the Tika settings', () => {
    const url = tikaPlugin.manifest.settings?.[0] as {
      validate?: (v: unknown, o: never) => unknown
    }
    const validate = (value: unknown) => url.validate?.(value, {} as never)
    expect(validate('http://tika:9998')).toBe(true)
    expect(validate('https://tika.example.org')).toBe(true)
    expect(validate('')).toBe(true)
    expect(validate('ftp://tika')).toBe('Use an http:// or https:// address.')
    expect(validate('not an address')).toBe('This is not an address.')
  })
})
