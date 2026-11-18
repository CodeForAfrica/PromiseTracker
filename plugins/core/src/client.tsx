'use client'

import { useFormFields, useRowLabel } from '@payloadcms/ui'
import type { UIFieldClientProps } from 'payload'

import { AA_CONTRAST, contrastRatio, formatRatio, isHexColour } from './contrast'

/**
 * Browser components for the admin. Payload loads them by path, such as
 * `@promisetracker/plugin-core/client#RatingContrast`, so they import nothing
 * that runs only on the server.
 */

const sibling = (path: string, name: string): string => path.replace(/[^.]+$/, name)

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
