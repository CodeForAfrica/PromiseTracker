'use client'

import { useFormFields, useRowLabel } from '@payloadcms/ui'
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

  const box = {
    border: '1px solid var(--theme-elevation-150)',
    borderRadius: 4,
    padding: '12px 16px',
    margin: '0 0 24px',
    lineHeight: 1.6,
  } as const
  if (state.kind === 'none') {
    return (
      <p style={{ ...box, color: 'var(--theme-elevation-600)' }}>
        Choose a source document to see the statement in it.
      </p>
    )
  }
  if (state.kind === 'loading') return <p style={box}>Reading the source document…</p>
  if (state.kind === 'missing') {
    return (
      <p style={box}>
        <strong>{state.title}.</strong> {state.reason}
      </p>
    )
  }
  return (
    <figure style={{ ...box, marginInline: 0 }}>
      <figcaption style={{ fontWeight: 600, marginBottom: 8 }}>In {state.title}</figcaption>
      <blockquote style={{ margin: 0 }}>
        {state.match.before}
        <mark>{state.match.quote}</mark>
        {state.match.after}
      </blockquote>
    </figure>
  )
}
