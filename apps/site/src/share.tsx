import type { Figures, Rating, SiteInfo } from '@promisetracker/contract'
import { figureFormat, scalesOf, tierCount } from '@promisetracker/ui'
import { ImageResponse } from 'next/og'
import type { ReactNode } from 'react'

/**
 * Share images (section 10.7). Each page type draws its own from its real
 * content, on one card. Figures follow the counts rule (section 10.4): the
 * API says whether to write "1 of 3" or "33%", and the image writes the same
 * as the page.
 */

export const SIZE = { width: 1200, height: 630 } as const
export const CONTENT_TYPE = 'image/png'

const INK = '#141414'
const INK_2 = '#5c5c5c'
const PAPER = '#ffffff'
const RULE = '#e6e6e6'

/** Cut long text at a word, so a long claim fits the card. */
export function clip(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1)
  const space = cut.lastIndexOf(' ')
  return `${(space > max / 2 ? cut.slice(0, space) : cut).trimEnd()}…`
}

/** One tier of a scale, with its count written as the API says. */
export type TierFigure = { label: string; colour: string; count: number; text: string }

/**
 * The tiers of the first scale the figures have claims on, as the page's
 * figures block draws them. Empty when there are no rated claims.
 */
export function tierFigures(site: SiteInfo, figures: Figures): TierFigure[] {
  const [first] = scalesOf(site, figures)
  if (!first) return []
  const format = figureFormat(site, first.figures)
  return first.scale.tiers
    .map((tier) => {
      const count = tierCount(first.scale, first.figures.byRating, tier.slug)
      return { label: tier.label, colour: tier.colour, count, text: format(count) }
    })
    .filter((tier) => tier.count > 0)
}

/**
 * Figures from several sets added up, such as every country's for the home
 * page. A set shown as percentages has reached the threshold, so their sum
 * has too. Otherwise the sum keeps counts, as each set did.
 */
export function addFigures(sets: readonly Figures[]): Figures {
  const sum = (key: 'byRating' | 'byTier') => {
    const out: Record<string, number> = {}
    for (const set of sets) {
      for (const [slug, n] of Object.entries(set[key])) out[slug] = (out[slug] ?? 0) + n
    }
    return out
  }
  return {
    total: sets.reduce((n, set) => n + set.total, 0),
    form: sets.some((set) => set.form === 'percentages') ? 'percentages' : 'counts',
    byRating: sum('byRating'),
    byTier: sum('byTier'),
  }
}

function TierBar({ tiers }: { tiers: readonly TierFigure[] }) {
  const total = tiers.reduce((n, tier) => n + tier.count, 0)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', height: 22, borderRadius: 11, overflow: 'hidden', gap: 3 }}>
        {tiers.map((tier) => (
          <div
            key={tier.label}
            style={{ display: 'flex', background: tier.colour, flexGrow: tier.count / total }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 36, flexWrap: 'wrap' }}>
        {tiers.map((tier) => (
          <div key={tier.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                display: 'flex',
                width: 18,
                height: 18,
                borderRadius: 9,
                background: tier.colour,
              }}
            />
            <div style={{ display: 'flex', fontSize: 28, color: INK_2 }}>{tier.label}</div>
            <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, color: INK }}>
              {tier.text}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** A rating as the claim page shows it: its label on its colours. */
function RatingBadge({ rating }: { rating: Rating }) {
  return (
    <div
      style={{
        display: 'flex',
        alignSelf: 'flex-start',
        padding: '12px 28px',
        borderRadius: 999,
        background: rating.colour,
        color: rating.textColour,
        fontSize: 34,
        fontWeight: 700,
      }}
    >
      {rating.label}
    </div>
  )
}

export type Card = {
  site: SiteInfo
  /** A small line above the title, such as the country or the actor. */
  kicker?: string | undefined
  title: string
  /** One line under the title. */
  detail?: string | null | undefined
  rating?: Rating | null | undefined
  tiers?: readonly TierFigure[] | undefined
}

/** The card every share image is drawn on. */
export function shareImage({ site, kicker, title, detail, rating, tiers }: Card): ImageResponse {
  const body: ReactNode = (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 72,
        background: PAPER,
        borderTop: `14px solid ${INK}`,
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {kicker && (
          <div style={{ display: 'flex', fontSize: 30, color: INK_2, letterSpacing: 1 }}>
            {clip(kicker, 70)}
          </div>
        )}
        <div
          style={{
            display: 'flex',
            fontSize: title.length > 90 ? 52 : 64,
            fontWeight: 700,
            color: INK,
            lineHeight: 1.15,
          }}
        >
          {clip(title, 160)}
        </div>
        {detail && (
          <div style={{ display: 'flex', fontSize: 30, color: INK_2, lineHeight: 1.35 }}>
            {clip(detail, 140)}
          </div>
        )}
        {rating && <RatingBadge rating={rating} />}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
        {tiers && tiers.length > 0 && <TierBar tiers={tiers} />}
        <div
          style={{
            display: 'flex',
            borderTop: `2px solid ${RULE}`,
            paddingTop: 24,
            fontSize: 28,
            fontWeight: 700,
            color: INK,
          }}
        >
          {site.name}
        </div>
      </div>
    </div>
  )
  return new ImageResponse(body, { ...SIZE })
}
