'use client'

import {
  Banner,
  Button,
  FieldDescription,
  FieldLabel,
  toast,
  useAuth,
  useConfig,
  useDocumentInfo,
  useFormFields,
  useRowLabel,
} from '@payloadcms/ui'
import type { UIFieldClientProps } from 'payload'
import { useEffect, useState } from 'react'

import { AA_CONTRAST, contrastRatio, formatRatio, isHexColour } from './contrast'
import type { QuoteMatch } from './quote'
import { findQuote } from './quote'

/**
 * Browser components for the admin. Payload loads them by path, such as
 * `@promisetracker/plugin-core/client#RatingContrast`, so they import nothing
 * that runs only on the server.
 */

const sibling = (path: string, name: string): string =>
  path.slice(0, path.lastIndexOf('.') + 1) + name

/**
 * Shows a rating as it will look, with the contrast of its text on its colour,
 * and warns while the pair fails WCAG AA (section 10.5). It warns rather than
 * refuses, so an editor can save while still choosing colours.
 */
export function RatingContrast({ path }: UIFieldClientProps) {
  const colour = useFormFields(([fields]) => fields[sibling(path, 'colour')]?.value)
  const text = useFormFields(([fields]) => fields[sibling(path, 'textColour')]?.value)
  const label = useFormFields(([fields]) => fields[sibling(path, 'label')]?.value)
  const ratio = contrastRatio(text, colour)
  if (ratio === null) return null
  const passes = ratio >= AA_CONTRAST
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '0 0 24px' }}>
      <span
        style={{
          background: isHexColour(colour) ? colour : undefined,
          color: isHexColour(text) ? text : undefined,
          borderRadius: 999,
          padding: '6px 10px',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '.1em',
          textTransform: 'uppercase',
        }}
      >
        {typeof label === 'string' && label ? label : 'Rating'}
      </span>
      <span
        role={passes ? undefined : 'alert'}
        style={{ fontSize: 13, color: passes ? undefined : 'var(--theme-error-500)' }}
      >
        {passes
          ? `Contrast ${formatRatio(ratio)} meets WCAG AA.`
          : `Contrast ${formatRatio(ratio)} fails WCAG AA, which needs ${AA_CONTRAST}:1. The label will be hard to read.`}
      </span>
    </div>
  )
}

function RowLabel({ fallback }: { fallback: string }) {
  const { data, rowNumber } = useRowLabel<{ label?: string; slug?: string; retired?: boolean }>()
  const name = data?.label || data?.slug || `${fallback} ${(rowNumber ?? 0) + 1}`
  return <span>{data?.retired ? `${name} (retired)` : name}</span>
}

export const TierRowLabel = () => <RowLabel fallback="Tier" />
export const RatingRowLabel = () => <RowLabel fallback="Rating" />

type QuoteState =
  | { kind: 'none' }
  | { kind: 'loading' }
  | { kind: 'found'; match: QuoteMatch; title: string }
  | { kind: 'missing'; title: string; reason: string }

const idOfValue = (value: unknown): string | null => {
  if (typeof value === 'string' && value) return value
  const id: unknown = value && typeof value === 'object' ? Reflect.get(value, 'id') : null
  return typeof id === 'string' ? id : null
}

/**
 * The claim's statement in its source document, highlighted, so a reviewer
 * can check the words before setting the verdict (section 5.1). It reads the
 * document through the admin's own REST routes, as the signed-in reviewer.
 */
export function SourceQuote() {
  const source = useFormFields(([fields]) => idOfValue(fields.source?.value))
  const statement = useFormFields(([fields]) => fields.statement?.value)
  const [state, setState] = useState<QuoteState>({ kind: 'none' })

  useEffect(() => {
    if (!source) {
      setState({ kind: 'none' })
      return
    }
    const controller = new AbortController()
    setState({ kind: 'loading' })
    fetch(`/api/documents/${source}?depth=0&select[title]=true&select[text]=true`, {
      credentials: 'include',
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((doc: { title?: string; text?: string | null } | null) => {
        const title = doc?.title ?? 'The source document'
        if (!doc?.text) {
          setState({ kind: 'missing', title, reason: 'Its text has not been read yet.' })
          return
        }
        const match = findQuote(doc.text, typeof statement === 'string' ? statement : '')
        setState(
          match
            ? { kind: 'found', match, title }
            : {
                kind: 'missing',
                title,
                reason: 'The statement is not in its text, word for word.',
              },
        )
      })
      .catch(() => undefined)
    return () => controller.abort()
  }, [source, statement])

  const label = <FieldLabel label="In the source document" />
  if (state.kind === 'none') {
    return (
      <div className="field-type">
        {label}
        <FieldDescription
          path="verification.quote"
          description="Choose a source document to see the statement in it."
        />
      </div>
    )
  }
  if (state.kind === 'loading') {
    return (
      <div className="field-type">
        {label}
        <FieldDescription path="verification.quote" description="Reading the source document…" />
      </div>
    )
  }
  if (state.kind === 'missing') {
    return (
      <div className="field-type">
        {label}
        <Banner type="warning">
          {state.title}: {state.reason}
        </Banner>
      </div>
    )
  }
  return (
    <div className="field-type">
      {label}
      <blockquote
        style={{
          margin: 0,
          padding: 'var(--spacer-2) var(--spacer-2-5)',
          background: 'var(--color-bg-secondary)',
          border: 'var(--stroke-width-small) solid var(--color-border)',
          borderRadius: 'var(--radius-medium)',
          color: 'var(--color-text-secondary)',
          fontSize: 'var(--text-body-medium-font-size)',
          lineHeight: 'var(--text-body-medium-line-height)',
        }}
      >
        {state.match.before}
        <mark
          style={{
            background: 'var(--color-bg-warning-tertiary)',
            color: 'var(--color-text)',
            borderRadius: 'var(--radius-small)',
            padding: '0 2px',
          }}
        >
          {state.match.quote}
        </mark>
        {state.match.after}
      </blockquote>
      <FieldDescription path="verification.quote" description={`From ${state.title}.`} />
    </div>
  )
}

/** Roles that may confirm a rating, as `rateClaims` in the access matrix (section 13.2). */
const RATERS = ['super-admin', 'editor']

/**
 * "Confirm rating" (section 8.4): an editor who checked a claim and found
 * nothing new records it, which moves the last-reviewed date without adding a
 * public update.
 */
export function ConfirmRating() {
  const { id } = useDocumentInfo()
  const { user } = useAuth()
  const { config } = useConfig()
  const dispatch = useFormFields(([, dispatchFields]) => dispatchFields)
  const [busy, setBusy] = useState(false)
  const roles: unknown = user ? Reflect.get(user, 'roles') : null
  const allowed = Array.isArray(roles) && roles.some((role) => RATERS.includes(String(role)))
  if (!id || !allowed) return null
  const confirm = async () => {
    setBusy(true)
    try {
      const res = await fetch(`${config.routes.api}/claims/${id}/confirm-rating`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) throw new Error(String(res.status))
      const { lastReviewedAt }: { lastReviewedAt?: unknown } = await res.json()
      // Shown in the sidebar without reloading, which would lose unsaved edits.
      // The field is the system's, so a save leaves it as stored.
      if (typeof lastReviewedAt === 'string') {
        dispatch({ type: 'UPDATE', path: 'lastReviewedAt', value: lastReviewedAt })
      }
      toast.success('Rating confirmed. The last-reviewed date is today.')
    } catch {
      toast.error('The rating could not be confirmed. Try again.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="field-type">
      <Button buttonStyle="secondary" size="medium" onClick={confirm} disabled={busy}>
        Confirm rating
      </Button>
      <FieldDescription
        path="confirmRating"
        description="You checked the claim and nothing has changed. Moves the last-reviewed date without a public update."
      />
    </div>
  )
}
