import type { ReactNode } from 'react'

import { cn } from './cn'

/** A section label with an optional rule above it. */
export function SectionLabel({
  children,
  rule = false,
  className,
  id,
}: {
  children: ReactNode
  rule?: boolean
  className?: string
  id?: string
}) {
  return (
    <h2
      id={id}
      className={cn(
        'mb-6 text-[12px] leading-none font-semibold tracking-[.18em] text-ink uppercase',
        rule && 'border-t border-line pt-4',
        className,
      )}
    >
      {children}
    </h2>
  )
}
