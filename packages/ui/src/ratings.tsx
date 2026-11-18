import type { Rating, RatingScale } from '@promisetracker/contract'

import { cn } from './cn'

/**
 * The redesign's rating atoms. Every rating, label, colour and count comes in
 * through props from the rating scales editors define (D22). Nothing here
 * knows how many ratings there are or what they are called.
 *
 * A rating is never shown by colour alone (section 10.5): the chip and the
 * legend carry its label, and the tier bar names every segment.
 */

/** How many claims carry each rating, by rating slug. A missing slug counts as none. */
export type RatingCounts = Readonly<Record<string, number>>

const countOf = (counts: RatingCounts, slug: string): number => counts[slug] ?? 0

/** A scale's ratings in display order: by tier, then as editors ordered them within it. */
export function orderedRatings(scale: RatingScale): Rating[] {
  const tierOrder = new Map(scale.tiers.map((t, i) => [t.slug, i]))
  const position = (r: Rating) => tierOrder.get(r.tier) ?? scale.tiers.length
  return scale.ratings
    .map((rating, i) => ({ rating, i }))
    .sort((a, b) => position(a.rating) - position(b.rating) || a.i - b.i)
    .map(({ rating }) => rating)
}

/** The ratings of one tier, in order. */
export const tierRatings = (scale: RatingScale, tier: string): Rating[] =>
  orderedRatings(scale).filter((r) => r.tier === tier)

/** How many claims a tier holds. */
export const tierCount = (scale: RatingScale, counts: RatingCounts, tier: string): number =>
  tierRatings(scale, tier).reduce((sum, r) => sum + countOf(counts, r.slug), 0)

/** The ratings a list shows: retired ones only while some claim still carries them. */
const shown = (scale: RatingScale, counts: RatingCounts, hideEmpty: boolean): Rating[] =>
  orderedRatings(scale).filter((r) => {
    const n = countOf(counts, r.slug)
    return n > 0 || (!hideEmpty && !r.retired)
  })

/** A rating as a filled chip with its label. */
export function RatingChip({ rating, className }: { rating: Rating; className?: string }) {
  return (
    <span
      className={cn(
        'inline-block rounded-full px-2.5 py-1.5 text-[10px] leading-none font-semibold tracking-[.1em] whitespace-nowrap uppercase',
        className,
      )}
      style={{ backgroundColor: rating.colour, color: rating.textColour }}
    >
      {rating.label}
    </span>
  )
}

/**
 * A rating's colour as a dot. Decoration only: always put the label beside it.
 * A thin ring keeps pale colours visible on pale backgrounds.
 */
export function RatingDot({ rating, className }: { rating: Rating; className?: string }) {
  return (
    <i
      aria-hidden="true"
      className={cn('block size-3 flex-none rounded-full', className)}
      style={{ backgroundColor: rating.colour, boxShadow: 'inset 0 0 0 1px rgb(0 0 0 / .12)' }}
    />
  )
}

/** Rating-by-rating counts. With `hideEmpty`, ratings at zero are left out rather than listed. */
export function RatingLegend({
  scale,
  counts,
  hideEmpty = false,
  leader = false,
  className,
}: {
  scale: RatingScale
  counts: RatingCounts
  hideEmpty?: boolean
  leader?: boolean
  className?: string
}) {
  return (
    <ul className={cn('grid gap-2', className)}>
      {shown(scale, counts, hideEmpty).map((r) => (
        <li key={r.slug} className="flex items-center gap-2.5 text-[13px] leading-[1.3]">
          <RatingDot rating={r} />
          {r.label}
          <span className={cn('flex-1', leader && 'border-b border-dotted border-line')} />
          <span className="text-ink-2">{countOf(counts, r.slug)}</span>
        </li>
      ))}
    </ul>
  )
}

/** What the tier bar shows, in words: each rating with claims, and its count. */
export const tierBarLabel = (scale: RatingScale, counts: RatingCounts): string =>
  shown(scale, counts, true)
    .map((r) => `${r.label}: ${countOf(counts, r.slug)}`)
    .join(', ')

type TierBarProps = {
  scale: RatingScale
  counts: RatingCounts
  /** Height, gaps and rounding as Tailwind classes. */
  className?: string
  groupClassName?: string
  segmentClassName?: string
  /** Read out instead of the bar. Defaults to each rating's label and count. */
  label?: string
}

/**
 * One group per tier, sized by its share, each split into its ratings. Sizes
 * are data, so they are set inline. Tiers and ratings with no claims are left
 * out.
 */
export function TierBar({
  scale,
  counts,
  className,
  groupClassName,
  segmentClassName,
  label,
}: TierBarProps) {
  return (
    <div
      role="img"
      aria-label={label ?? tierBarLabel(scale, counts)}
      className={cn('flex overflow-hidden', className)}
    >
      {scale.tiers.map((tier) => {
        const n = tierCount(scale, counts, tier.slug)
        if (n === 0) return null
        return (
          <span
            key={tier.slug}
            className={cn('flex min-w-0 overflow-hidden', groupClassName)}
            style={{ flex: `${n} 1 0%` }}
          >
            {tierRatings(scale, tier.slug).map((r) => {
              const count = countOf(counts, r.slug)
              return count === 0 ? null : (
                <i
                  key={r.slug}
                  title={`${r.label}: ${count}`}
                  className={cn('block min-w-0', segmentClassName)}
                  style={{ flex: `${count} 1 0%`, backgroundColor: r.colour }}
                />
              )
            })}
          </span>
        )
      })}
    </div>
  )
}
