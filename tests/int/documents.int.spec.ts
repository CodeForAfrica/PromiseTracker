import { getPayload } from '@promisetracker/cms'
import { resetCircuitBreakers } from '@promisetracker/kernel'
import type { CountryCode } from '@promisetracker/plugin-core'
import {
  cleanupJobs,
  cleanupJobsTask,
  FAILED_JOB_DAYS,
  queueProcessing,
  setTagRefresher,
} from '@promisetracker/plugin-core'
import type { Payload, PayloadRequest } from 'payload'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { unusedCountryCodes } from '../countries'

// The link connector looks every host up. Here every host is public, so the
// tests reach the stubbed fetch below and never the network.
vi.mock('node:dns/promises', async (original) => {
  const real = await original<typeof import('node:dns/promises')>()
  const lookup = vi.fn(async () => [{ address: '93.184.216.34', family: 4 }])
  return { ...real, default: { ...real, lookup }, lookup }
})

/**
 * Documents and the pipeline against a real database and file store
 * (sections 7.8, 9.2 to 9.4, 9.7, 9.8 and 13.4): upload and link, the type
 * check, one stored copy per file, statuses, retries, the uploader's email,
 * concurrency and job clean-up.
 */
describe('documents and the processing pipeline', () => {
  let payload: Payload
  let country: string
  type User = NonNullable<PayloadRequest['user']>
  let contributor: User
  const created: { collection: 'documents' | 'document-files' | 'users'; id: string }[] = []

  const FRENCH =
    'Le gouvernement s’engage à créer 500 000 emplois d’ici à 2027 : écoles, hôpitaux, Côte d’Ivoire, Œuvre.'

  const fileOf = (name: string, mimetype: string, content: string | Uint8Array) => {
    const data = Buffer.from(
      typeof content === 'string' ? new TextEncoder().encode(content) : content,
    )
    return { data, mimetype, name, size: data.length }
  }

  /** Each test's file differs, so none is turned away as already stored. */
  const unique = (text: string) => `${text}\n${crypto.randomUUID()}`

  const upload = async (name: string, mimetype: string, content: string | Uint8Array) => {
    const doc = await payload.create({
      collection: 'document-files',
      data: {},
      file: fileOf(name, mimetype, content),
      user: contributor,
      overrideAccess: false,
    })
    created.push({ collection: 'document-files', id: doc.id })
    return doc
  }

  const addDocument = async (data: Record<string, unknown>) => {
    const doc = await payload.create({
      collection: 'documents',
      data: { title: 'Manifeste', country, ...data } as never,
      user: contributor,
      overrideAccess: false,
    })
    created.push({ collection: 'documents', id: doc.id })
    return doc
  }

  const DONE = new Set(['extracted', 'failed', 'completed'])

  /** The document once processing stops: done, failed, or waiting for a later run. */
  const settled = async (id: string, until = (s: string) => DONE.has(s)) => {
    const deadline = Date.now() + 30_000
    for (;;) {
      const doc = await payload.findByID({ collection: 'documents', id, overrideAccess: true })
      if (doc.status && until(doc.status)) return doc
      if (Date.now() > deadline) throw new Error(`Still ${doc.status}: ${doc.statusMessage}`)
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }

  const jobsFor = async (id: string) =>
    (
      await payload.find({
        collection: 'payload-jobs',
        where: { concurrencyKey: { equals: `document:${id}` } },
        sort: 'createdAt',
        overrideAccess: true,
      })
    ).docs

  beforeAll(async () => {
    payload = await getPayload()
    // No site to refresh in these tests.
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
    const user = await payload.create({
      collection: 'users',
      data: {
        email: `contributor-${crypto.randomUUID()}@example.org`,
        password: `pw-${crypto.randomUUID()}`,
        name: 'Contributor',
        roles: ['contributor'],
      },
      overrideAccess: true,
    })
    created.push({ collection: 'users', id: user.id })
    contributor = { ...user, collection: 'users' } as User
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    resetCircuitBreakers()
  })

  afterAll(async () => {
    // Clean-up writes as the system.
    for (const { collection, id } of created.reverse()) {
      await payload.delete({ collection, id, overrideAccess: true }).catch(() => {})
    }
    await payload.delete({ collection: 'countries', id: country, overrideAccess: true })
    await payload.destroy()
  })

  describe('uploading a file', () => {
    it('reads accented French text into the document, keeping every character', async () => {
      const content = unique(FRENCH.normalize('NFD'))
      const file = await upload('manifeste.txt', 'text/plain', content)
      const doc = await addDocument({ connector: 'upload', file: file.id, language: 'fr' })
      expect(doc.status).toBe('pending')

      const done = await settled(doc.id)
      expect(done.status).toBe('extracted')
      expect(done.detectedType).toBe('text/plain')
      expect(done.text).toBe(content.normalize('NFC'))
      expect(done.text).toContain('créer')
      expect(done.text).toContain('Œuvre')
      expect(done.lastAttemptAt).toBeTruthy()
    })

    it('runs both stages in one workflow, keyed to the document', async () => {
      const file = await upload('notes.md', 'text/markdown', unique('# Engagements'))
      const doc = await addDocument({ connector: 'upload', file: file.id })
      await settled(doc.id)
      const [job] = await jobsFor(doc.id)
      expect(job).toMatchObject({
        workflowSlug: 'processDocument',
        concurrencyKey: `document:${doc.id}`,
      })
      expect(Object.keys(job?.taskStatus ?? {}).sort()).toEqual(['extractText', 'fetchDocument'])
    })

    it('stores a file once, and points to the copy already stored', async () => {
      const content = unique('Same file twice')
      const first = await upload('a.txt', 'text/plain', content)
      expect(first.checksum).toMatch(/^[0-9a-f]{64}$/)
      expect(first.credit ?? null).toBeNull()
      await expect(upload('b.txt', 'text/plain', content)).rejects.toThrow(/already stored/)
    })

    it('keeps the file’s credit, and the file before a replacement in its history', async () => {
      const file = await upload('credit.txt', 'text/plain', unique('Version one'))
      await payload.update({
        collection: 'document-files',
        id: file.id,
        data: { credit: 'Ministry of Finance' },
        file: fileOf('credit.txt', 'text/plain', unique('Version two')),
        user: contributor,
        overrideAccess: false,
      })
      const versions = await payload.findVersions({
        collection: 'document-files',
        where: { parent: { equals: file.id } },
        overrideAccess: true,
      })
      expect(versions.docs.length).toBeGreaterThanOrEqual(2)
      const checksums = new Set(versions.docs.map((v) => v.version.checksum))
      expect(checksums.size).toBe(2)
    })

    it('refuses a file whose content does not match its type, and SVG', async () => {
      const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2])
      await expect(upload('fake.txt', 'text/plain', png)).rejects.toThrow(/does not match/)
      await expect(
        upload('logo.svg', 'image/svg+xml', '<svg xmlns="http://www.w3.org/2000/svg"/>'),
      ).rejects.toThrow(/SVG/)
    })

    it('fails a file no enabled plugin reads, and tells the uploader by email', async () => {
      const info = vi.spyOn(payload.logger, 'info')
      const pdf = `%PDF-1.7\n${crypto.randomUUID()}`
      const file = await upload('plan.pdf', 'application/pdf', pdf)
      const doc = await addDocument({ title: 'Plan national', connector: 'upload', file: file.id })
      const done = await settled(doc.id)
      expect(done.status).toBe('failed')
      expect(done.statusMessage).toMatch(/No enabled plugin reads application\/pdf/)
      expect(done.retryCount).toBe(1)

      const emailed = info.mock.calls.find(
        (args: unknown[]) => args[1] === 'Emailed the uploader that a document failed',
      )?.[0] as Record<string, unknown> | undefined
      expect(emailed).toMatchObject({
        source: 'documents',
        subject: '“Plan national” could not be processed',
        sent: true,
      })
      expect(String(emailed?.text)).toMatch(/No enabled plugin reads application\/pdf/)
      expect(String(emailed?.text)).toContain(`/admin/collections/documents/${doc.id}`)
      // Logs never hold email addresses (section 13.7).
      expect(JSON.stringify(emailed)).not.toContain('@example.org')
    })
  })

  describe('fetching a link', () => {
    const page = (body: string) =>
      `<!doctype html><html><body><nav>Menu</nav><main><p>${body}</p></main><footer>Footer</footer></body></html>`

    it('fetches once, reads the page without its furniture, and stores the file once', async () => {
      const body = `Nous construirons ${crypto.randomUUID()} routes.`
      const fetchMock = vi.fn(
        async () =>
          new Response(page(body), { headers: { 'content-type': 'text/html; charset=utf-8' } }),
      )
      vi.stubGlobal('fetch', fetchMock)
      const doc = await addDocument({ connector: 'url', sourceUrl: 'https://example.org/plan' })
      const done = await settled(doc.id)
      expect(done.status).toBe('extracted')
      expect(done.text).toBe(body)
      expect(done.detectedType).toBe('text/html')
      expect(fetchMock).toHaveBeenCalledTimes(1)
      const fileId = typeof done.file === 'object' ? done.file?.id : done.file
      expect(fileId).toBeTruthy()

      // The same file from another link is not stored again.
      const again = await addDocument({ connector: 'url', sourceUrl: 'https://example.org/copy' })
      const second = await settled(again.id)
      const secondId = typeof second.file === 'object' ? second.file?.id : second.file
      expect(secondId).toBe(fileId)
      if (fileId) created.push({ collection: 'document-files', id: fileId })
    })

    it('refuses a private address without fetching it', async () => {
      const fetchMock = vi.fn(async () => new Response('secret'))
      vi.stubGlobal('fetch', fetchMock)
      const doc = await addDocument({
        connector: 'url',
        sourceUrl: 'https://169.254.169.254/latest/meta-data',
      })
      const done = await settled(doc.id)
      expect(done.status).toBe('failed')
      expect(done.statusMessage).toMatch(/blocked address/)
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('fails a link that is gone, at once', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response('gone', { status: 404 })),
      )
      const doc = await addDocument({ connector: 'url', sourceUrl: 'https://example.org/gone' })
      const done = await settled(doc.id)
      expect(done.status).toBe('failed')
      expect(done.statusMessage).toMatch(/HTTP 404/)
    })

    it('puts the document back in the queue for as long as a busy server asks', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(
          async () => new Response('slow down', { status: 429, headers: { 'retry-after': '120' } }),
        ),
      )
      const before = Date.now()
      const doc = await addDocument({ connector: 'url', sourceUrl: 'https://example.org/busy' })
      const waiting = await vi.waitFor(
        async () => {
          const now = await payload.findByID({
            collection: 'documents',
            id: doc.id,
            overrideAccess: true,
          })
          expect(now.statusMessage).toMatch(/Trying again in 120 seconds \(run 2 of 3\)/)
          return now
        },
        { timeout: 20_000, interval: 100 },
      )
      expect(waiting.status).toBe('pending')
      const jobs = await jobsFor(doc.id)
      const next = jobs.find((j) => !j.completedAt)
      expect(next?.waitUntil).toBeTruthy()
      expect(new Date(next?.waitUntil ?? 0).getTime()).toBeGreaterThanOrEqual(before + 119_000)
    })
  })

  describe('rules', () => {
    it('never runs two jobs for one document: a newer one replaces one still waiting', async () => {
      const file = await upload('queued.txt', 'text/plain', unique('Queued'))
      const doc = await addDocument({ connector: 'upload', file: file.id })
      await settled(doc.id)
      const later = new Date(Date.now() + 60 * 60_000)
      await queueProcessing(payload, doc.id, later)
      await queueProcessing(payload, doc.id, later)
      const waiting = (await jobsFor(doc.id)).filter((j) => !j.completedAt)
      expect(waiting).toHaveLength(1)
      expect(waiting[0]?.concurrencyKey).toBe(`document:${doc.id}`)
    })

    it('ignores a user writing the status, and restarts only when the file or link changes', async () => {
      const file = await upload('rules.txt', 'text/plain', unique('Rules'))
      const doc = await addDocument({ connector: 'upload', file: file.id, status: 'completed' })
      expect(doc.status).toBe('pending')
      const done = await settled(doc.id)
      const renamed = await payload.update({
        collection: 'documents',
        id: doc.id,
        data: { title: 'Renamed', status: 'failed', text: 'forged' } as never,
        user: contributor,
        overrideAccess: false,
      })
      expect(renamed.status).toBe(done.status)
      expect(renamed.text).toBe(done.text)
    })

    it('shows each document’s status and message in the admin list', () => {
      const columns = payload.collections.documents.config.admin.defaultColumns
      expect(columns).toEqual(expect.arrayContaining(['status', 'statusMessage', 'lastAttemptAt']))
    })

    it('needs a file to upload, or a link to fetch', async () => {
      await expect(addDocument({ connector: 'upload' })).rejects.toThrow(/Upload a file/)
      await expect(addDocument({ connector: 'url' })).rejects.toThrow(/Paste the link/)
    })

    it('keeps documents and their files from guests', async () => {
      await expect(
        payload.find({ collection: 'documents', overrideAccess: false }),
      ).rejects.toThrow()
      await expect(
        payload.find({ collection: 'document-files', overrideAccess: false }),
      ).rejects.toThrow()
    })
  })

  describe('cleaning up jobs (sections 9.8 and 13.9)', () => {
    it('runs hourly', () => {
      expect(cleanupJobsTask.schedule).toEqual([{ cron: '0 0 * * * *', queue: 'default' }])
      const task = payload.config.jobs.tasks?.find((t) => t.slug === 'cleanupJobs')
      expect(task?.schedule?.[0]?.cron).toBe('0 0 * * * *')
    })

    it('removes finished jobs, and failed ones after 7 days', async () => {
      const make = async (data: Record<string, unknown>) => {
        const job = await payload.jobs.queue({
          task: 'cleanupJobs',
          input: {},
          overrideAccess: true,
          // Far off, so no worker runs it during the test.
          waitUntil: new Date(Date.now() + 24 * 60 * 60_000),
        })
        await payload.db.updateOne({ collection: 'payload-jobs', id: job.id, data })
        return String(job.id)
      }
      const now = new Date()
      const old = new Date(now.getTime() - (FAILED_JOB_DAYS + 1) * 24 * 60 * 60_000).toISOString()
      const finished = await make({ completedAt: now.toISOString() })
      const failedLongAgo = await make({ hasError: true, updatedAt: old })
      const failedToday = await make({ hasError: true })
      const waiting = await make({})

      await cleanupJobs(payload, now)
      const left = new Set(
        (
          await payload.find({
            collection: 'payload-jobs',
            where: { id: { in: [finished, failedLongAgo, failedToday, waiting] } },
            overrideAccess: true,
          })
        ).docs.map((j) => String(j.id)),
      )
      expect(left).toEqual(new Set([failedToday, waiting]))
      await payload.delete({
        collection: 'payload-jobs',
        where: { id: { in: [failedToday, waiting] } },
        overrideAccess: true,
      })
    })
  })
})
