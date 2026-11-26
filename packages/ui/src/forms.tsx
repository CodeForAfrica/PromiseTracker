'use client'

import type { CaptchaChallenge, Strings, SubmissionReceipt } from '@promisetracker/contract'
import Link from 'next/link'
import type { FormEvent } from 'react'
import { useId, useRef, useState } from 'react'

import { cn } from './cn'
import { fill } from './fill'

/**
 * The public forms (sections 12 and 13.5), from the redesign's update form
 * and footer sign-up. They post to `/api/v1` from the browser, after solving
 * the server's proof-of-work challenge. A hidden field, `website`, is left
 * empty by people and filled in by bots.
 */

const API = '/api/v1'

/** Whether a SHA-256 digest starts with `bits` zero bits. */
function leadingZeroBits(digest: Uint8Array, bits: number): boolean {
  let left = bits
  for (const byte of digest) {
    if (left <= 0) return true
    if (left >= 8) {
      if (byte !== 0) return false
      left -= 8
    } else {
      return byte >> (8 - left) === 0
    }
  }
  return left <= 0
}

/**
 * Asks the server for a challenge and finds its answer: a number that, hashed
 * with the challenge, starts with enough zero bits. A second or two on a phone.
 */
async function captchaAnswer(locale: string): Promise<string> {
  const res = await fetch(`${API}/captcha?locale=${encodeURIComponent(locale)}`, {
    cache: 'no-store',
  })
  if (!res.ok) throw new Error('captcha')
  const { data } = (await res.json()) as CaptchaChallenge
  const challenge = String(data.challenge ?? '')
  const bits = Number(data.bits ?? 0)
  const encoder = new TextEncoder()
  for (let nonce = 0; nonce < 50_000_000; nonce++) {
    const digest = new Uint8Array(
      await crypto.subtle.digest('SHA-256', encoder.encode(`${challenge}:${nonce}`)),
    )
    if (leadingZeroBits(digest, bits)) return `${challenge}:${nonce}`
  }
  throw new Error('captcha')
}

/** The trap field. Hidden from people and from screen readers, so only bots fill it in. */
function Trap() {
  return (
    // Clipped rather than moved off-screen, which would widen a right-to-left page.
    <div aria-hidden="true" className="sr-only">
      <label>
        Website
        <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
      </label>
    </div>
  )
}

const label =
  'mb-2.5 block text-[10px] leading-none font-semibold tracking-[.14em] text-muted uppercase'
const field =
  'w-full rounded-lg border border-line bg-white px-[15px] py-[13px] text-[14px] leading-normal text-ink outline-none placeholder:text-subtle focus:border-ink'
const errorText = 'text-[12.5px] text-[#b42318]'

type Kind = 'evidence' | 'correction' | 'changed'

const KINDS: readonly Kind[] = ['evidence', 'correction', 'changed']

/** The most a file may weigh, as the API allows. */
const MAX_FILE = 20 * 1024 * 1024
const MAX_FILES = 5

const sizeOf = (bytes: number) =>
  bytes > 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`

export type UpdateContext = {
  locale: string
  country: string
  claim: string
  claimTitle: string
  actor: string
  where: string
  rating: string | null
  claimHref: string
  privacyHref: string
}

/**
 * Sending an update about a claim (section 7.9): new evidence, a correction
 * or something that changed. `?kind=` chooses the kind, read by the page.
 */
export function UpdateForm({
  strings: t,
  context,
  kind: initialKind,
}: {
  strings: Strings
  context: UpdateContext
  kind: Kind
}) {
  const [kind, setKind] = useState<Kind>(initialKind)
  const [files, setFiles] = useState<File[]>([])
  const [fileError, setFileError] = useState('')
  const [textError, setTextError] = useState(false)
  const [status, setStatus] = useState<
    'idle' | 'checking' | 'sending' | 'sent' | 'failed' | 'limited'
  >('idle')
  const [receipt, setReceipt] = useState<SubmissionReceipt | null>(null)
  const id = useId()
  const fileInput = useRef<HTMLInputElement>(null)

  const names: Record<Kind, [string, string]> = {
    evidence: [t.kindEvidence, t.kindEvidenceHint],
    correction: [t.kindCorrection, t.kindCorrectionHint],
    changed: [t.kindChanged, t.kindChangedHint],
  }

  function addFiles(list: FileList | null) {
    if (!list) return
    const all = Array.from(list)
    const ok = all.filter((f) => f.size <= MAX_FILE)
    const big = all.filter((f) => f.size > MAX_FILE).map((f) => f.name)
    setFiles((prev) => [...prev, ...ok].slice(0, MAX_FILES))
    setFileError(big.length ? fill(t.fileTooBig, { name: big.join(', ') }) : '')
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const text = String(form.get('text') ?? '').trim()
    if (!text) {
      setTextError(true)
      document.getElementById(`${id}-text`)?.focus()
      return
    }
    setStatus('checking')
    try {
      const captcha = await captchaAnswer(context.locale)
      setStatus('sending')
      const body = new FormData()
      body.set('locale', context.locale)
      body.set('country', context.country)
      body.set('claim', context.claim)
      body.set('kind', kind)
      body.set('text', text)
      for (const name of ['location', 'evidenceUrl', 'name', 'contact', 'website'] as const) {
        const value = String(form.get(name) ?? '').trim()
        if (value || name === 'website') body.set(name, value)
      }
      body.set('consent', form.get('consent') === 'on' ? 'true' : 'false')
      body.set('captcha', captcha)
      for (const file of files) body.append('files', file)
      const res = await fetch(`${API}/submissions`, { method: 'POST', body })
      if (res.status === 429) {
        setStatus('limited')
        return
      }
      if (!res.ok) throw new Error(String(res.status))
      setReceipt((await res.json()) as SubmissionReceipt)
      setStatus('sent')
      window.scrollTo({ top: 0 })
    } catch {
      setStatus('failed')
    }
  }

  if (status === 'sent' && receipt) {
    return (
      <div className="grid max-w-[640px] gap-[22px]">
        <div role="status" className="rounded-lg bg-verified/10 px-6 py-[26px]">
          <p className="mb-3.5 flex items-center gap-2.5 text-[10px] font-medium tracking-[.14em] text-verified-ink uppercase">
            <i aria-hidden="true" className="block size-[9px] rounded-full bg-verified" />
            {t.received}
          </p>
          <h1 className="mb-3 max-w-[26ch] text-[24px] leading-[1.25] font-semibold tracking-[-.02em]">
            {t.thanks}
          </h1>
          <p className="mb-4 max-w-[48ch] text-[14px] leading-[1.65] text-ink-2">{t.thanksBody}</p>
          <dl className="grid gap-[9px] border-t border-verified/30 pt-4 text-[12.5px]">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-2">{t.reference}</dt>
              <dd className="font-medium">{receipt.reference}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-2">{t.sentOn}</dt>
              <dd className="font-medium">{receipt.sent}</dd>
            </div>
          </dl>
          <p className="mt-4 text-[12px] leading-[1.6] text-ink-2">{t.noEta}</p>
        </div>
        <div>
          <Link
            href={context.claimHref}
            className="inline-block rounded-lg bg-ink px-6 py-4 text-[12px] leading-none font-medium tracking-[.06em] text-white uppercase hover:text-white hover:opacity-85"
          >
            {t.backToClaimForm}
          </Link>
        </div>
      </div>
    )
  }

  const busy = status === 'checking' || status === 'sending'
  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="relative grid items-start gap-[52px] md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]"
    >
      <Trap />
      <div>
        <h1 className="mb-3.5 max-w-[24ch] text-[28px] leading-[1.12] font-semibold tracking-[-.014em] sm:text-[34px]">
          {t.updateSeen}
        </h1>
        <p className="mb-[22px] max-w-[52ch] text-[15px] leading-[1.65] text-ink-2">
          {t.updateLede}
        </p>
        <fieldset className="mb-[26px]">
          <legend className={label}>{t.whatSending}</legend>
          <div className="grid gap-2">
            {KINDS.map((k) => (
              <label
                key={k}
                className={cn(
                  'cursor-pointer rounded-lg border px-4 py-3.5 text-[13px] leading-[1.4] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-verified/40',
                  kind === k
                    ? 'border-verified bg-verified/10 font-medium text-verified-ink'
                    : 'border-line bg-white text-ink-2',
                )}
              >
                <input
                  type="radio"
                  name="kind"
                  value={k}
                  checked={kind === k}
                  onChange={() => setKind(k)}
                  className="sr-only"
                />
                {names[k][0]}
                {'  '}
                <span className="font-normal text-muted">{names[k][1]}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="rounded-lg bg-surface px-5 py-[18px]">
          <p className={label}>{t.attached}</p>
          <dl className="grid gap-[9px] text-[13px] text-ink-2">
            {(
              [
                [t.attachedClaim, context.claimTitle],
                [t.attachedActor, context.actor],
                [t.attachedWhere, context.where],
                [t.attachedRating, context.rating],
              ] as const
            )
              .filter((row): row is [string, string] => Boolean(row[1]))
              .map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-muted">{k}</dt>
                  <dd className="text-end font-medium">{v}</dd>
                </div>
              ))}
          </dl>
          <p className="mt-3.5 text-[12px] leading-[1.6] text-ink-2">{t.attachedNote}</p>
        </div>
      </div>

      <div>
        {files.length > 0 && (
          <ul className="mb-4 grid gap-2">
            {files.map((f, i) => (
              <li
                key={`${f.name}-${f.size}-${f.lastModified}`}
                className="flex items-center gap-3.5 rounded-lg border border-verified bg-verified/10 px-[18px] py-3"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{f.name}</span>
                  <span className="text-[11px] text-ink-2 uppercase">{sizeOf(f.size)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                  aria-label={fill(t.removeFile, { name: f.name })}
                  className="min-h-11 min-w-11 cursor-pointer text-[13px] text-muted hover:text-ink"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        {files.length < MAX_FILES && (
          <label className="mb-5 block cursor-pointer rounded-lg border border-dashed border-verified bg-white px-[18px] py-4 text-center hover:bg-verified/10 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-verified/40">
            <input
              ref={fileInput}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
              className="sr-only"
              onChange={(e) => {
                addFiles(e.target.files)
                if (fileInput.current) fileInput.current.value = ''
              }}
            />
            <span className="block text-[13px] font-medium text-verified-ink">
              {files.length ? t.addAnother : t.addFile}
            </span>
            <span className="mt-[3px] block text-[11px] text-ink-2 uppercase">{t.fileLimit}</span>
          </label>
        )}
        {fileError && <p className={cn('-mt-3 mb-5', errorText)}>{fileError}</p>}

        <label htmlFor={`${id}-text`} className={label}>
          {t.whatSaw}
        </label>
        <textarea
          id={`${id}-text`}
          name="text"
          rows={4}
          maxLength={5000}
          placeholder={t.whatSawPlaceholder}
          aria-invalid={textError}
          aria-describedby={textError ? `${id}-text-error` : undefined}
          onChange={() => textError && setTextError(false)}
          className={cn(field, 'mb-1 resize-y', textError && 'border-[#b42318]')}
        />
        <p
          id={`${id}-text-error`}
          className={cn('mb-5 min-h-4', errorText, !textError && 'invisible')}
        >
          {t.whatSawRequired}
        </p>

        <label htmlFor={`${id}-where`} className={label}>
          {t.whereSpecific}
        </label>
        <input
          id={`${id}-where`}
          name="location"
          maxLength={200}
          defaultValue={context.where}
          aria-describedby={`${id}-where-note`}
          className={cn(field, 'mb-1')}
        />
        <p id={`${id}-where-note`} className="mb-5 text-[12px] text-muted">
          {t.prefilled}
        </p>

        <label htmlFor={`${id}-link`} className={label}>
          {t.evidenceLink}
        </label>
        <input
          id={`${id}-link`}
          name="evidenceUrl"
          type="url"
          maxLength={500}
          placeholder="https://"
          aria-describedby={`${id}-link-note`}
          className={cn(field, 'mb-1')}
        />
        <p id={`${id}-link-note`} className="mb-5 text-[12px] text-muted">
          {t.evidenceLinkHint}
        </p>

        <label htmlFor={`${id}-name`} className={label}>
          {t.yourName}
        </label>
        <input
          id={`${id}-name`}
          name="name"
          maxLength={120}
          autoComplete="name"
          className={cn(field, 'mb-2.5')}
        />
        <label className="mb-5 flex items-start gap-2.5 text-[13px] leading-[1.5] text-ink-2">
          <input type="checkbox" name="consent" className="mt-1 size-4 accent-verified" />
          {t.consentCredit}
        </label>

        <label htmlFor={`${id}-contact`} className={label}>
          {t.reach}
        </label>
        <input
          id={`${id}-contact`}
          name="contact"
          maxLength={200}
          autoComplete="email"
          placeholder={t.reachPlaceholder}
          aria-describedby={`${id}-contact-note`}
          className={cn(field, 'mb-2.5')}
        />
        <p id={`${id}-contact-note`} className="mb-[22px] text-[12px] leading-[1.6] text-ink-2">
          {t.reachNote}{' '}
          <Link href={context.privacyHref} className="underline underline-offset-2">
            {t.privacyLink}
          </Link>
        </p>

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={busy}
            className="min-h-11 cursor-pointer rounded-lg bg-verified px-6 py-4 text-[12px] leading-none font-medium tracking-[.06em] text-white uppercase hover:opacity-85 disabled:cursor-wait disabled:opacity-60"
          >
            {status === 'checking'
              ? t.checkingBrowser
              : status === 'sending'
                ? t.sending
                : t.sendIt}
          </button>
          <span className="text-[11px] tracking-[.05em] text-muted uppercase">{t.noAccount}</span>
        </div>
        <p role="alert" className={cn('mt-4', errorText)}>
          {status === 'failed' ? t.formFailed : status === 'limited' ? t.tooMany : ''}
        </p>
      </div>
    </form>
  )
}

/** The footer's newsletter sign-up. Nothing is subscribed until the emailed link is opened. */
export function SubscribeForm({
  strings: t,
  locale,
  privacyHref,
}: {
  strings: Strings
  locale: string
  privacyHref: string
}) {
  const [status, setStatus] = useState<'idle' | 'invalid' | 'busy' | 'done' | 'failed' | 'limited'>(
    'idle',
  )

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '').trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus('invalid')
      return
    }
    setStatus('busy')
    try {
      const captcha = await captchaAnswer(locale)
      const res = await fetch(`${API}/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locale,
          email,
          website: String(form.get('website') ?? ''),
          captcha,
        }),
      })
      if (res.status === 429) return setStatus('limited')
      if (!res.ok) throw new Error(String(res.status))
      setStatus('done')
    } catch {
      setStatus('failed')
    }
  }

  if (status === 'done') {
    return (
      <p role="status" className="text-[14px] text-verified-ink">
        {t.subscribeDone}
      </p>
    )
  }
  const message =
    status === 'invalid'
      ? t.subscribeInvalid
      : status === 'failed'
        ? t.formFailed
        : status === 'limited'
          ? t.tooMany
          : ''
  return (
    <form onSubmit={onSubmit} noValidate className="relative grid w-full max-w-[360px] gap-2">
      <Trap />
      <div className="flex items-center gap-2 rounded-full border border-line-2 bg-surface py-1 ps-5 pe-1 focus-within:border-ink">
        <label htmlFor="subscribe-email" className="sr-only">
          {t.subscribeEmail}
        </label>
        <input
          id="subscribe-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.org"
          aria-invalid={status === 'invalid'}
          aria-describedby="subscribe-message"
          onChange={() => status === 'invalid' && setStatus('idle')}
          className="min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-faint"
        />
        <button
          type="submit"
          disabled={status === 'busy'}
          className="min-h-11 flex-none cursor-pointer rounded-full bg-ink px-[22px] text-[14px] font-semibold text-white hover:opacity-85 disabled:cursor-wait disabled:opacity-60"
        >
          {status === 'busy' ? t.sending : t.subscribe}
        </button>
      </div>
      <p id="subscribe-message" role="alert" className={cn('ps-5', errorText)}>
        {message}
      </p>
      <p className="ps-5 text-[12px] text-muted">
        <Link href={privacyHref} className="text-muted underline underline-offset-2">
          {t.privacyLink}
        </Link>
      </p>
    </form>
  )
}

/**
 * Confirms a sign-up from its email. A button, not the link itself, so a mail
 * scanner opening the link does not confirm on the reader's behalf.
 */
export function ConfirmSignup({ strings: t, token }: { strings: Strings; token: string }) {
  const [status, setStatus] = useState<'idle' | 'busy' | 'confirmed' | 'failed'>('idle')
  async function confirm() {
    setStatus('busy')
    try {
      const res = await fetch(`${API}/subscriptions/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const { confirmed } = (await res.json()) as { confirmed?: boolean }
      setStatus(res.ok && confirmed ? 'confirmed' : 'failed')
    } catch {
      setStatus('failed')
    }
  }
  if (status === 'confirmed') {
    return (
      <p role="status" className="text-[16px] text-verified-ink">
        {t.newsletterConfirmed}
      </p>
    )
  }
  if (status === 'failed') {
    return (
      <p role="alert" className={cn('text-[15px]', errorText)}>
        {t.newsletterFailed}
      </p>
    )
  }
  return (
    <button
      type="button"
      onClick={confirm}
      disabled={status === 'busy' || !token}
      className="min-h-11 cursor-pointer rounded-lg bg-ink px-6 py-4 text-[12px] leading-none font-medium tracking-[.06em] text-white uppercase hover:opacity-85 disabled:cursor-wait disabled:opacity-60"
    >
      {t.newsletterConfirm}
    </button>
  )
}
