import type { ReactNode } from 'react'

import { cn } from './cn'

/** A native disclosure row: the summary, then the text when opened. */
export function Disclosure({
  summary,
  children,
  className,
}: {
  summary: string
  children: ReactNode
  className?: string
}) {
  return (
    <details className={cn('group', className)}>
      <summary className="flex cursor-pointer list-none items-center gap-2.5 py-[13px] text-[13px] leading-[1.4] font-medium [&::-webkit-details-marker]:hidden">
        <span>{summary}</span>
        <span className="flex-1" />
        <span
          aria-hidden="true"
          className="text-[15px] leading-none text-muted transition-transform group-open:rotate-45"
        >
          +
        </span>
      </summary>
      <div className="max-w-[70ch] pb-4 text-[14px] leading-[1.65] whitespace-pre-line text-ink-2">
        {children}
      </div>
    </details>
  )
}
