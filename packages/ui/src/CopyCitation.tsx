'use client'

import { useState } from 'react'

/**
 * "Copy citation" (section 10.2): copies the claim's permanent address and
 * the date its rating was last reviewed. A path is made absolute with the
 * address the reader is on, for a site with no public address set.
 */
export function CopyCitation({
  url,
  text,
  label,
  done,
}: {
  url: string
  text: string
  label: string
  done: string
}) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    const full = url.startsWith('/') ? text.replace(url, window.location.origin + url) : text
    try {
      await navigator.clipboard.writeText(full)
      setCopied(true)
    } catch {
      // No clipboard, such as on an insecure page: the reader can still select the text.
      window.prompt(label, full)
    }
  }
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={copy}
        className="rounded-full border border-line px-3 py-1.5 text-[12px] font-medium text-ink hover:bg-surface"
      >
        {label}
      </button>
      <span role="status" className="text-[12px] text-ink-2">
        {copied ? done : ''}
      </span>
    </span>
  )
}
