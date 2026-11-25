'use client'

import {
  Banner,
  Button,
  FieldLabel,
  toast,
  useAuth,
  useConfig,
  useDocumentInfo,
} from '@payloadcms/ui'
import type { QuoteMatch } from '@promisetracker/plugin-core/quote'
import { findQuote } from '@promisetracker/plugin-core/quote'
import { useCallback, useEffect, useState } from 'react'

/**
 * The admin's AI screens (section 9.5). Payload loads them by path, such as
 * `@promisetracker/plugin-ai/client#CandidateReview`, so they import nothing
 * that runs only on the server. They read and write through the admin's own
 * REST routes, as the signed-in user.
 */

/** Roles that may accept or reject candidates, as `reviewCandidates` (section 13.2). */
const REVIEWERS = ['super-admin', 'editor', 'reviewer']
/** Roles that may run AI over a document again. */
const RUNNERS = ['super-admin', 'editor', 'contributor', 'reviewer']

const hasRole = (user: unknown, roles: readonly string[]) => {
  const held: unknown = user && typeof user === 'object' ? Reflect.get(user, 'roles') : null
  return Array.isArray(held) && held.some((role) => roles.includes(String(role)))
}

type Candidate = {
  id: string
  title?: string | null
  summary?: string | null
  topic?: string | null
  quotes?: string[] | null
  confidence?: number | null
  decision?: 'pending' | 'accepted' | 'rejected' | null
  reason?: string | null
  claim?: string | { id: string } | null
}

type Extraction = {
  id: string
  status?: string | null
  document?: string | { id: string } | null
  candidates?: Candidate[] | null
}

type Option = { id: string; label: string }

type Source = { title: string; text: string; actors: Option[] }

const idOf = (value: unknown): string | null => {
  if (typeof value === 'string' && value) return value
  const id: unknown = value && typeof value === 'object' ? Reflect.get(value, 'id') : null
  return typeof id === 'string' ? id : null
}

const nameOf = (value: unknown): string => {
  if (!value || typeof value !== 'object') return ''
  const name: unknown = Reflect.get(value, 'name') ?? Reflect.get(value, 'title')
  return typeof name === 'string' ? name : ''
}

const box = {
  border: 'var(--stroke-width-small, 1px) solid var(--color-border, var(--theme-elevation-150))',
  borderRadius: 'var(--radius-medium, 4px)',
  padding: 'var(--spacer-2-5, 16px)',
  marginBottom: 'var(--spacer-2-5, 16px)',
} as const

const mark = {
  background: 'var(--color-bg-warning-tertiary, var(--theme-warning-100))',
  color: 'var(--color-text, inherit)',
  borderRadius: 2,
  padding: '0 2px',
} as const

function Quote({ match }: { match: QuoteMatch }) {
  return (
    <blockquote style={{ margin: '8px 0', color: 'var(--theme-elevation-800)', lineHeight: 1.5 }}>
      {match.before}
      <mark style={mark}>{match.quote}</mark>
      {match.after}
    </blockquote>
  )
}

/** Native inputs, styled like Payload's own fields. */
const input = {
  display: 'block',
  width: '100%',
  marginTop: 4,
  padding: '8px 12px',
  font: 'inherit',
  color: 'var(--color-text, inherit)',
  background: 'var(--color-bg, transparent)',
  border: 'var(--stroke-width-small, 1px) solid var(--color-border, #d4d4d4)',
  borderRadius: 'var(--style-radius-s, 4px)',
} as const

const link = { textDecoration: 'underline', color: 'inherit' } as const

const DECISION_LABEL = { pending: 'Waiting', accepted: 'Accepted', rejected: 'Rejected' } as const

/**
 * One candidate: its quotes highlighted in the document's text, and accept,
 * edit and accept, or reject with a reason.
 */
function CandidateCard({
  extraction,
  candidate,
  source,
  topics,
  canReview,
  onDone,
}: {
  extraction: string
  candidate: Candidate
  source: Source | null
  topics: Option[]
  canReview: boolean
  onDone: () => void
}) {
  const { config } = useConfig()
  const api = config.routes.api
  const quotes = candidate.quotes ?? []
  const suggested = topics.find(
    (t) => t.label.toLowerCase() === (candidate.topic ?? '').trim().toLowerCase(),
  )
  const [mode, setMode] = useState<'view' | 'edit' | 'reject'>('view')
  const [title, setTitle] = useState(candidate.title ?? '')
  const [summary, setSummary] = useState(candidate.summary ?? '')
  const [statement, setStatement] = useState(quotes[0] ?? '')
  const [actor, setActor] = useState(
    source?.actors.length === 1 ? (source.actors[0]?.id ?? '') : '',
  )
  const [topic, setTopic] = useState(suggested?.id ?? '')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const decision = candidate.decision ?? 'pending'

  useEffect(() => {
    if (!actor && source?.actors.length === 1) setActor(source.actors[0]?.id ?? '')
  }, [source, actor])
  useEffect(() => {
    if (!topic && suggested) setTopic(suggested.id)
  }, [suggested, topic])

  const post = async (action: 'accept' | 'reject', body: Record<string, unknown>) => {
    setBusy(true)
    try {
      const res = await fetch(
        `${api}/extractions/${extraction}/candidates/${candidate.id}/${action}`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      )
      const answer: { error?: string } = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(answer.error ?? 'The decision could not be saved.')
      toast.success(
        action === 'accept' ? 'Accepted. The claim is on hold and unverified.' : 'Rejected.',
      )
      onDone()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The decision could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  const acceptNow = (edited: boolean) =>
    post('accept', {
      ...(actor ? { actor } : {}),
      ...(topic ? { topic } : {}),
      ...(edited ? { title, summary, statement } : {}),
    })

  const claimId = idOf(candidate.claim)
  return (
    <article style={box} data-candidate={candidate.id}>
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <h4 style={{ margin: 0 }}>{candidate.title}</h4>
        <span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
          {DECISION_LABEL[decision]}
          {typeof candidate.confidence === 'number'
            ? ` · ${Math.round(candidate.confidence * 100)}% sure`
            : ''}
        </span>
      </header>
      <p style={{ margin: '8px 0' }}>{candidate.summary}</p>
      {candidate.topic ? (
        <p style={{ margin: '0 0 8px', fontSize: 13 }}>Suggested topic: {candidate.topic}</p>
      ) : null}
      {quotes.map((quote) => {
        const match = source ? findQuote(source.text, quote) : null
        return match ? (
          <Quote key={quote} match={match} />
        ) : (
          <blockquote key={quote} style={{ margin: '8px 0' }}>
            <mark style={mark}>{quote}</mark>
          </blockquote>
        )
      })}
      {decision === 'rejected' && candidate.reason ? (
        <p style={{ fontSize: 13 }}>Why: {candidate.reason}</p>
      ) : null}
      {decision === 'accepted' && claimId ? (
        <p style={{ fontSize: 13 }}>
          <a href={`${config.routes.admin}/collections/claims/${claimId}`} style={link}>
            Open the claim
          </a>
        </p>
      ) : null}
      {canReview && decision === 'pending' ? (
        <div style={{ marginTop: 12 }}>
          {mode !== 'view' ? null : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button size="medium" onClick={() => acceptNow(false)} disabled={busy}>
                Accept
              </Button>
              <Button size="medium" buttonStyle="secondary" onClick={() => setMode('edit')}>
                Edit and accept
              </Button>
              <Button size="medium" buttonStyle="secondary" onClick={() => setMode('reject')}>
                Reject
              </Button>
            </div>
          )}
          {mode !== 'view' && source && source.actors.length !== 1 ? (
            <label style={{ display: 'block', margin: '8px 0' }}>
              Actor{' '}
              <select value={actor} onChange={(e) => setActor(e.target.value)} style={input}>
                <option value="">Choose…</option>
                {source.actors.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {mode === 'edit' ? (
            <div style={{ display: 'grid', gap: 8 }}>
              <label>
                Title
                <input value={title} onChange={(e) => setTitle(e.target.value)} style={input} />
              </label>
              <label>
                Summary
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  style={input}
                />
              </label>
              <label>
                Statement, the exact words
                <select
                  value={statement}
                  onChange={(e) => setStatement(e.target.value)}
                  style={input}
                >
                  {quotes.map((q) => (
                    <option key={q} value={q}>
                      {q}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Topic{' '}
                <select value={topic} onChange={(e) => setTopic(e.target.value)} style={input}>
                  <option value="">None</option>
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button
                  size="medium"
                  onClick={() => acceptNow(true)}
                  disabled={busy || !title.trim()}
                >
                  Accept
                </Button>
                <Button size="medium" buttonStyle="secondary" onClick={() => setMode('view')}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
          {mode === 'reject' ? (
            <div style={{ display: 'grid', gap: 8 }}>
              <label>
                Why is it rejected?
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Not a commitment, a duplicate of another claim, …"
                  style={input}
                />
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button
                  size="medium"
                  onClick={() => post('reject', { reason })}
                  disabled={busy || !reason.trim()}
                >
                  Reject
                </Button>
                <Button size="medium" buttonStyle="secondary" onClick={() => setMode('view')}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}

/** The review screen, on an extraction's page (section 9.5). */
export function CandidateReview() {
  const { id } = useDocumentInfo()
  const { user } = useAuth()
  const { config } = useConfig()
  const api = config.routes.api
  const fallbackLocale = config.localization ? config.localization.defaultLocale : 'en'
  const [extraction, setExtraction] = useState<Extraction | null>(null)
  const [source, setSource] = useState<Source | null>(null)
  const [topics, setTopics] = useState<Option[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    try {
      const res = await fetch(`${api}/extractions/${id}?depth=0`, { credentials: 'include' })
      if (!res.ok) throw new Error(String(res.status))
      const next: Extraction = await res.json()
      setExtraction(next)
      const documentId = idOf(next.document)
      if (documentId) {
        const doc = await fetch(
          `${api}/documents/${documentId}?depth=1&select[title]=true&select[text]=true&select[actors]=true&select[language]=true`,
          { credentials: 'include' },
        ).then((r) => (r.ok ? r.json() : null))
        if (doc) {
          const actors: unknown[] = Array.isArray(doc.actors) ? doc.actors : []
          setSource({
            title: typeof doc.title === 'string' ? doc.title : '',
            text: typeof doc.text === 'string' ? doc.text : '',
            actors: actors
              .map((a) => ({ id: idOf(a) ?? '', label: nameOf(a) || (idOf(a) ?? '') }))
              .filter((a) => a.id),
          })
          // Topic names in the document's language, which the suggested topic is in.
          // Sorted here: Payload's REST sort on a localized field fails in 4.0 beta.
          const locale = typeof doc.language === 'string' ? doc.language : fallbackLocale
          const list: { docs?: unknown[] } = await fetch(
            `${api}/topics?depth=0&limit=500&select[name]=true&locale=${encodeURIComponent(locale)}`,
            { credentials: 'include' },
          ).then((r) => (r.ok ? r.json() : { docs: [] }))
          setTopics(
            (list.docs ?? [])
              .map((t) => ({ id: idOf(t) ?? '', label: nameOf(t) }))
              .filter((t) => t.id && t.label)
              .sort((a, b) => a.label.localeCompare(b.label)),
          )
        }
      }
    } catch {
      setError('The extraction could not be read. Reload the page.')
    }
  }, [api, id, fallbackLocale])

  useEffect(() => {
    void load()
  }, [load])

  if (!id) return null
  if (error) return <Banner type="danger">{error}</Banner>
  if (!extraction) return <p>Reading the extraction…</p>
  const candidates = extraction.candidates ?? []
  const canReview = hasRole(user, REVIEWERS)
  const pending = candidates.filter((c) => (c.decision ?? 'pending') === 'pending').length
  return (
    <div className="field-type" style={{ marginBottom: 32 }}>
      <FieldLabel label="Candidates" />
      <p style={{ marginTop: 0 }}>
        {candidates.length === 0
          ? extraction.status === 'running'
            ? 'AI is still reading the document.'
            : 'AI found no claims whose quotes are in the text.'
          : `${candidates.length} found${source?.title ? ` in “${source.title}”` : ''}, ${pending} waiting for review. Every quote is in the document word for word.`}
      </p>
      {source && source.actors.length === 0 && pending > 0 ? (
        <Banner type="warning">
          The document names no actor. Add who made these claims to the document before accepting.
        </Banner>
      ) : null}
      {candidates.map((candidate) => (
        <CandidateCard
          key={candidate.id}
          extraction={extraction.id}
          candidate={candidate}
          source={source}
          topics={topics}
          canReview={canReview}
          onDone={() => void load()}
        />
      ))}
    </div>
  )
}

/** On a document: run AI over it again, and see its extractions. */
export function FindClaims() {
  const { id } = useDocumentInfo()
  const { user } = useAuth()
  const { config } = useConfig()
  const [busy, setBusy] = useState(false)
  if (!id) return null
  const list = `${config.routes.admin}/collections/extractions?where[document][equals]=${id}`
  const run = async () => {
    setBusy(true)
    try {
      const res = await fetch(`${config.routes.api}/extractions/run`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document: id }),
      })
      const answer: { error?: string } = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(answer.error ?? 'AI could not be started.')
      toast.success('AI is reading the document again. The new extraction joins the earlier ones.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'AI could not be started.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="field-type">
      <FieldLabel label="Claims found by AI" />
      <p style={{ marginTop: 0 }}>
        <a href={list} style={link}>
          See this document’s extractions
        </a>
      </p>
      {hasRole(user, RUNNERS) ? (
        <Button size="medium" buttonStyle="secondary" onClick={run} disabled={busy}>
          Find claims again
        </Button>
      ) : null}
    </div>
  )
}
