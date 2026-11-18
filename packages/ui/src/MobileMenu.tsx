'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * Below the `nav` breakpoint the country nav moves into a full-screen menu
 * rather than a strip that scrolls sideways.
 */
export function MobileMenu({
  logo,
  footer,
  labels,
  children,
}: {
  logo: ReactNode
  footer?: ReactNode
  labels: { open: string; close: string; nav: string }
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // A link in the menu leads to a new page, which closes it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: closes on every change of page
  useEffect(() => setOpen(false), [pathname])

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={labels.open}
        className="inline-flex size-11 flex-none cursor-pointer items-center justify-center rounded-full border border-line bg-white text-ink hover:opacity-70 nav:hidden"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      {open &&
        createPortal(
          <div
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label={labels.open}
            className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-white nav:hidden"
          >
            <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4 sm:px-10">
              {logo}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={labels.close}
                className="inline-flex size-11 flex-none cursor-pointer items-center justify-center rounded-full border border-line bg-white text-ink hover:opacity-70"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <nav aria-label={labels.nav} className="grid px-5 sm:px-10">
              {children}
            </nav>
            {footer && (
              <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-line px-5 py-5 sm:px-10">
                {footer}
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  )
}
