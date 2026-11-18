import type { ReactNode } from 'react'

import { cn } from './cn'

/** The content column, with the redesign's 40px gutter on wider screens. */
export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('mx-auto w-full max-w-[1120px] px-5 sm:px-10', className)}>{children}</div>
  )
}
