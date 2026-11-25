import { readFile } from 'node:fs/promises'

import { getHealth, getPayload } from '@promisetracker/cms'
import { readSettings, resetCircuitBreakers } from '@promisetracker/kernel'
import type { CountryCode } from '@promisetracker/plugin-core'
import { isEncrypted, SECRET_MASK, setTagRefresher } from '@promisetracker/plugin-core'
import type { Payload, PayloadRequest } from 'payload'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import { unusedCountryCodes } from '../countries'
import { docxWith, pdfWith } from '../fixtures/documents'

/**
 * plugin-tika against the Tika container from `pnpm services` and CI
 * (sections 6.2, 9.3, 13.7 and 16.3): French PDF and Word files, a
 * spreadsheet read as a document, a damaged file, the encrypted address and
 * the health report. The integration tests enable the plugin
 * (vitest.config.ts).
 */
describe('plugin-tika', () => {
  let payload: Payload
  let country: string
  type User = NonNullable<PayloadRequest['user']>
  let contributor: User
  let superAdmin: User
  const created: { collection: 'documents' | 'document-files' | 'users'; id: string }[] = []

  const TIKA_URL = `http://localhost:${process.env.PT_TIKA_PORT ?? '9998'}`
  const FRENCH =
    'Le gouvernement s’engage à créer 500 000 emplois d’ici à 2027 : écoles, hôpitaux, Côte d’Ivoire, Œuvre.'

  const PDF = 'application/pdf'
  const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

  const storedUrl = async () => {
    // The adapter's own read: no hooks, so this is what the database holds.
    const raw = (await payload.db.findGlobal({ slug: 'settings', req: {} as PayloadRequest })) as {
      tika?: { url?: string | null }
    } | null
    return raw?.tika?.url ?? null
  }

  const setUrl = (url: string | null, user?: User) =>
    payload.updateGlobal({
      slug: 'settings',
      data: { tika: { url } },
      ...(user ? { user, overrideAccess: false } : { overrideAccess: true }),
    })

  const readAs = async (title: string, name: string, mimetype: string, data: Uint8Array) => {
    const buffer = Buffer.from(data)
    const file = await payload.create({
      collection: 'document-files',
      data: {},
      file: { data: buffer, mimetype, name, size: buffer.length },
      user: contributor,
      overrideAccess: false,
    })
    created.push({ collection: 'document-files', id: file.id })
    const doc = await payload.create({
      collection: 'documents',
      data: { title, country, connector: 'upload', file: file.id } as never,
      user: contributor,
      overrideAccess: false,
    })
    created.push({ collection: 'documents', id: doc.id })
    const deadline = Date.now() + 60_000
    for (;;) {
      const now = await payload.findByID({
        collection: 'documents',
        id: doc.id,
        overrideAccess: true,
      })
      if (now.status === 'extracted' || now.status === 'failed') return now
      if (Date.now() > deadline) throw new Error(`Still ${now.status}: ${now.statusMessage}`)
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
  }

  /** Each test's file differs, so none is turned away as already stored. */
  const unique = () => `Réf. ${crypto.randomUUID()}`

  const user = async (role: 'contributor' | 'super-admin') => {
    const doc = await payload.create({
      collection: 'users',
      data: {
        email: `${role}-${crypto.randomUUID()}@example.org`,
        password: `pw-${crypto.randomUUID()}`,
        name: role,
        roles: [role],
      },
      overrideAccess: true,
    })
    created.push({ collection: 'users', id: doc.id })
    return { ...doc, collection: 'users' } as User
  }

  beforeAll(async () => {
    payload = await getPayload()
    setTagRefresher(async () => {})
    const [code = 'st'] = (await unusedCountryCodes(payload, 1)) as CountryCode[]
    // Test set-up writes as the system.
    country = (
      await payload.create({
        collection: 'countries',
        locale: 'en',
        data: { code, recordStatus: 'ready' },
        overrideAccess: true,
      })
    ).id
    contributor = await user('contributor')
    superAdmin = await user('super-admin')
    await setUrl(TIKA_URL)
  })

  afterEach(() => resetCircuitBreakers())

  afterAll(async () => {
    await setUrl(null)
    for (const { collection, id } of created.reverse()) {
      await payload.delete({ collection, id, overrideAccess: true }).catch(() => {})
    }
    await payload.delete({ collection: 'countries', id: country, overrideAccess: true })
    await payload.destroy()
  })

  describe('reading files', () => {
    it('reads a French PDF, keeping every character, with its page count', async () => {
      const extra = unique()
      const doc = await readAs('Manifeste', 'manifeste.pdf', PDF, pdfWith([FRENCH, extra]))
      expect(doc.status).toBe('extracted')
      expect(doc.detectedType).toBe(PDF)
      expect(doc.text).toContain(FRENCH)
      expect(doc.text).toContain(extra)
      expect(doc.text).toBe(doc.text?.normalize('NFC'))
      expect(doc.pageCount).toBe(2)
    })

    it('reads a French Word file', async () => {
      const extra = unique()
      const doc = await readAs('Discours', 'discours.docx', DOCX, docxWith([FRENCH, extra]))
      expect(doc.status).toBe('extracted')
      expect(doc.text).toBe(`${FRENCH}\n${extra}`)
    })

    it('reads a spreadsheet uploaded as a document as text, not as records', async () => {
      const xlsx = await readFile(new URL('../fixtures/kenya-offices.xlsx', import.meta.url))
      const doc = await readAs('Offices', 'kenya-offices.xlsx', XLSX, new Uint8Array(xlsx))
      expect(doc.status).toBe('extracted')
      expect(doc.text).toContain('Président')
      expect(doc.text).toContain('Gouverneur')
    })

    it('fails a damaged file at once, saying why', async () => {
      const broken = new TextEncoder().encode(`%PDF-1.4\n${crypto.randomUUID()}`)
      const doc = await readAs('Abîmé', 'abime.pdf', PDF, broken)
      expect(doc.status).toBe('failed')
      expect(doc.statusMessage).toMatch(/could not read the file/)
      expect(doc.retryCount).toBe(1)
    })
  })

  describe('its address in settings (section 13.7)', () => {
    it('is stored encrypted, and read whole by the system', async () => {
      const stored = await storedUrl()
      expect(isEncrypted(stored)).toBe(true)
      expect(stored).not.toContain('localhost')
      const settings = await readSettings(payload, Date.now() + 60_000)
      expect(settings).toMatchObject({ tika: { url: TIKA_URL } })
    })

    it('shows a super-admin a mask, and keeps the address when the mask is saved back', async () => {
      const shown = await payload.findGlobal({
        slug: 'settings',
        user: superAdmin,
        overrideAccess: false,
      })
      expect(shown.tika?.url).toBe(SECRET_MASK)
      const before = await storedUrl()
      await setUrl(SECRET_MASK, superAdmin)
      expect(await storedUrl()).toBe(before)
    })

    it('is closed to everyone but super-admins', async () => {
      await expect(
        payload.findGlobal({ slug: 'settings', user: contributor, overrideAccess: false }),
      ).rejects.toThrow()
    })
  })

  describe('health (section 16.3)', () => {
    it('reports Tika in /api/health, and never in the readiness check', async () => {
      const health = await getHealth()
      expect(health.plugins.enabled).toContain('tika')
      expect(health.ports.contentExtractor).toEqual(['plaintext', 'tika'])
      expect(health.services.tika).toMatchObject({ healthy: true, kind: 'tika' })
      const ready = await getHealth('required')
      expect(Object.keys(ready.services).sort()).toEqual(['database', 'storage'])
    })
  })
})
