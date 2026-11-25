import type { ReactNode } from 'react'

import { cn } from './cn'

/** A section label with an optional rule above it. */
export function SectionLabel({
  children,
  rule = false,
  className,
  id,
  as: Heading = 'h2',
}: {
  children: ReactNode
  rule?: boolean
  className?: string
  id?: string
  /** A sub-heading inside a section is an h3. */
  as?: 'h2' | 'h3'
}) {
  return (
    <Heading
      id={id}
      className={cn(
        'mb-6 text-[12px] leading-none font-semibold tracking-[.18em] text-ink uppercase',
        rule && 'border-t border-line pt-4',
        className,
      )}
    >
      {children}
    </Heading>
  )
}
