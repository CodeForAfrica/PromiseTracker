import { createLog } from '@promisetracker/kernel'
import { ADMIN_GROUPS, signedIn, userCan } from '@promisetracker/plugin-core'
import type { CollectionConfig, Endpoint, PayloadRequest } from 'payload'
import { commitTransaction, initTransaction, killTransaction } from 'payload'

import { queueExtraction } from './job'

/**
 * Extractions (section 7.8): one AI run over one document, with its
 * candidates. Running AI again makes a new extraction and keeps the old ones,
 * so nobody edits or deletes one. Reviewers decide each candidate through the
 * endpoints below, which the review screen calls.
 */

export const EXTRACTIONS = 'extractions'

export const EXTRACTION_STATES = ['running', 'completed', 'failed'] as const
export type ExtractionState = (typeof EXTRACTION_STATES)[number]

export const DECISIONS = ['pending', 'accepted', 'rejected'] as const
export type Decision = (typeof DECISIONS)[number]

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const idOf = (value: unknown): string | null => {
  if (typeof value === 'string' && value) return value
  const id: unknown = value && typeof value === 'object' ? Reflect.get(value, 'id') : null
  return typeof id === 'string' && id ? id : null
}

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null

const fail = (status: number, error: string) =>
  Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } })

async function bodyOf(req: PayloadRequest): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await req.json?.()
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

type CandidateRow = {
  id?: string | null
  title?: string | null
  summary?: string | null
  topic?: string | null
  quotes?: string[] | null
  confidence?: number | null
  decision?: Decision | null
}

type ExtractionRow = {
  id: string
  document?: unknown
  status?: ExtractionState | null
  candidates?: CandidateRow[] | null
}

/** The extraction and the candidate a review names, or the answer saying why not. */
async function loadCandidate(
  req: PayloadRequest,
): Promise<
  | { ok: true; extraction: ExtractionRow; candidate: CandidateRow; index: number }
  | { ok: false; response: Response }
> {
  if (!userCan(req.user, 'reviewCandidates')) {
    return { ok: false, response: fail(403, 'You cannot review candidates.') }
  }
  const id = String(req.routeParams?.id ?? '')
  const candidateId = String(req.routeParams?.candidate ?? '')
  if (!UUID.test(id)) return { ok: false, response: fail(404, 'There is no such extraction.') }
  const extraction = (await req.payload
    .findByID({
      collection: EXTRACTIONS as never,
      id,
      depth: 0,
      // The reviewer's right was checked above.
      overrideAccess: true,
      req,
    })
    .catch(() => null)) as ExtractionRow | null
  if (!extraction) return { ok: false, response: fail(404, 'There is no such extraction.') }
  const candidates = extraction.candidates ?? []
  const index = candidates.findIndex((c) => c.id === candidateId)
  const candidate = candidates[index]
  if (!candidate) return { ok: false, response: fail(404, 'There is no such candidate.') }
  if ((candidate.decision ?? 'pending') !== 'pending') {
    return {
      ok: false,
      response: fail(409, `This candidate was already ${candidate.decision}.`),
    }
  }
  return { ok: true, extraction, candidate, index }
}

/** Writes one candidate's decision, keeping the others as they are. */
async function decide(
  req: PayloadRequest,
  extraction: ExtractionRow,
  index: number,
  decision: Record<string, unknown>,
) {
  const candidates = (extraction.candidates ?? []).map((c, i) =>
    i === index
      ? { ...c, ...decision, reviewer: req.user?.id, reviewedAt: new Date().toISOString() }
      : c,
  )
  await req.payload.update({
    collection: EXTRACTIONS as never,
    id: extraction.id,
    data: { candidates } as never,
    depth: 0,
    // Extractions are read-only to everyone: decisions are written here alone.
    overrideAccess: true,
    req,
  })
}

/**
 * Accepts a candidate, as it is or edited: a new claim, on hold and
 * unverified, linked to the extraction, and marked as found by AI (section
 * 9.5). The claim and the decision save together, or not at all.
 */
const accept: Endpoint = {
  path: '/:id/candidates/:candidate/accept',
  method: 'post',
  handler: async (req) => {
    const found = await loadCandidate(req)
    if (!found.ok) return found.response
    const { extraction, candidate, index } = found
    const body = await bodyOf(req)
    const documentId = idOf(extraction.document)
    const document = documentId
      ? ((await req.payload
          .findByID({
            collection: 'documents',
            id: documentId,
            depth: 0,
            overrideAccess: true,
            req,
          })
          .catch(() => null)) as { actors?: unknown[] | null; language?: string | null } | null)
      : null
    const actors = (document?.actors ?? []).map(idOf).filter((a): a is string => Boolean(a))
    const actor = text(body.actor) ?? (actors.length === 1 ? actors[0] : null)
    if (!actor || !UUID.test(actor)) {
      return fail(
        400,
        actors.length === 0
          ? 'Add the actor who made these claims to the document first.'
          : 'Choose the actor who made this claim.',
      )
    }
    const title = text(body.title) ?? text(candidate.title)
    if (!title) return fail(400, 'Give the claim a title.')
    const quotes = candidate.quotes ?? []
    const statement = text(body.statement) ?? quotes[0] ?? null
    const summary = text(body.summary) ?? text(candidate.summary)
    const topic = text(body.topic)
    // The claim's title and summary are in the document's language, as the quotes are.
    const locale = text(document?.language)

    const started = await initTransaction(req)
    try {
      const claim = await req.payload.create({
        collection: 'claims',
        ...(locale ? { locale: locale as never } : {}),
        data: {
          title,
          statement,
          summary,
          actor,
          ...(topic && UUID.test(topic) ? { topic } : {}),
          source: documentId,
          recordStatus: 'hold',
          extraction: 'ai',
          ...(typeof candidate.confidence === 'number' ? { confidence: candidate.confidence } : {}),
          ai: { extraction: extraction.id, candidate: candidate.id },
        } as never,
        depth: 0,
        // A reviewer accepts candidates but does not create claims by hand
        // (section 13.2). The claim records the reviewer as who entered it.
        overrideAccess: true,
        req,
      })
      const claimId = String((claim as { id: unknown }).id)
      await decide(req, extraction, index, { decision: 'accepted', claim: claimId, reason: null })
      if (started) await commitTransaction(req)
      createLog(req.payload.logger, 'ai').info('Accepted a candidate', {
        ids: { extraction: extraction.id, claim: claimId },
      })
      return Response.json({ claim: claimId })
    } catch (error) {
      if (started) await killTransaction(req)
      const message = error instanceof Error ? error.message : 'The claim could not be saved.'
      return fail(400, message)
    }
  },
}

/** Rejects a candidate, with the reason, so the next reviewer sees why. */
const reject: Endpoint = {
  path: '/:id/candidates/:candidate/reject',
  method: 'post',
  handler: async (req) => {
    const found = await loadCandidate(req)
    if (!found.ok) return found.response
    const reason = text((await bodyOf(req)).reason)
    if (!reason) return fail(400, 'Say why the candidate is rejected.')
    await decide(req, found.extraction, found.index, { decision: 'rejected', reason })
    return Response.json({ ok: true })
  },
}

/** Runs AI over a document again. The new extraction joins the earlier ones (section 7.8). */
const runAgain: Endpoint = {
  path: '/run',
  method: 'post',
  handler: async (req) => {
    if (!userCan(req.user, 'editRecords') && !userCan(req.user, 'reviewCandidates')) {
      return fail(403, 'You cannot run AI over documents.')
    }
    const documentId = text((await bodyOf(req)).document)
    if (!documentId || !UUID.test(documentId)) return fail(404, 'There is no such document.')
    const doc = (await req.payload
      .findByID({ collection: 'documents', id: documentId, depth: 0, overrideAccess: true, req })
      .catch(() => null)) as { text?: string | null; type?: string | null } | null
    if (!doc) return fail(404, 'There is no such document.')
    if (!doc.text?.trim()) return fail(409, 'The document’s text has not been read yet.')
    const job = await queueExtraction(req.payload, documentId, { again: true })
    void req.payload.jobs.runByID({ id: job, overrideAccess: true }).catch(() => undefined)
    return Response.json({ job })
  },
}

const readOnly = { readOnly: true } as const

export const Extractions: CollectionConfig = {
  slug: EXTRACTIONS,
  labels: { singular: 'Extraction', plural: 'Extractions' },
  admin: {
    group: ADMIN_GROUPS.sources,
    useAsTitle: 'model',
    defaultColumns: ['document', 'status', 'pending', 'model', 'createdAt'],
    description:
      'Each time AI reads a document for claims. Open one to accept or reject what it found.',
  },
  access: {
    read: signedIn,
    // Made by the extraction job, changed only by the review endpoints, never deleted.
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  // An extraction is its own record of what happened: decisions are stamped
  // with who and when, and a new run makes a new extraction.
  versions: false,
  endpoints: [accept, reject, runAgain],
  fields: [
    {
      name: 'review',
      type: 'ui',
      admin: { components: { Field: '@promisetracker/plugin-ai/client#CandidateReview' } },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'document',
          type: 'relationship',
          relationTo: 'documents',
          // Not required: deleting a document for good leaves its extractions,
          // as a record of what AI was sent, pointing nowhere.
          index: true,
          admin: readOnly,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          defaultValue: 'running',
          options: EXTRACTION_STATES.map((value) => ({ label: value, value })),
          admin: readOnly,
        },
      ],
    },
    {
      name: 'message',
      type: 'textarea',
      admin: { ...readOnly, condition: (data) => Boolean(data?.message) },
    },
    {
      type: 'collapsible',
      label: 'The run',
      admin: { position: 'sidebar' },
      fields: [
        { name: 'model', type: 'text', required: true, admin: readOnly },
        { name: 'promptVersion', label: 'Prompt version', type: 'text', admin: readOnly },
        { name: 'sections', type: 'number', admin: readOnly },
        { name: 'inputTokens', label: 'Input tokens', type: 'number', admin: readOnly },
        { name: 'outputTokens', label: 'Output tokens', type: 'number', admin: readOnly },
        {
          name: 'pending',
          label: 'Waiting for review',
          type: 'number',
          admin: { ...readOnly, description: 'Candidates nobody has accepted or rejected yet.' },
        },
      ],
    },
    {
      name: 'candidates',
      type: 'array',
      // The review screen above shows them, with their quotes in the source.
      admin: { ...readOnly, hidden: true },
      fields: [
        { name: 'title', type: 'text' },
        { name: 'summary', type: 'textarea' },
        { name: 'topic', label: 'Suggested topic', type: 'text' },
        { name: 'quotes', type: 'text', hasMany: true },
        { name: 'confidence', type: 'number', min: 0, max: 1 },
        {
          name: 'decision',
          type: 'select',
          defaultValue: 'pending',
          options: DECISIONS.map((value) => ({ label: value, value })),
        },
        { name: 'reason', type: 'textarea' },
        { name: 'reviewer', type: 'relationship', relationTo: 'users' },
        { name: 'reviewedAt', type: 'date' },
        { name: 'claim', type: 'relationship', relationTo: 'claims' },
      ],
    },
  ],
  hooks: {
    beforeChange: [
      ({ data }) => {
        const rows = Array.isArray(data.candidates) ? (data.candidates as CandidateRow[]) : null
        if (!rows) return data
        return {
          ...data,
          pending: rows.filter((c) => (c.decision ?? 'pending') === 'pending').length,
        }
      },
    ],
  },
}
