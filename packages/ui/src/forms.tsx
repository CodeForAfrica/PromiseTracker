'use client'

import type { Strings } from '@promisetracker/contract'
import Link from 'next/link'
import type { FormEvent } from 'react'
import { useId, useState } from 'react'

import { cn } from './cn'
import { fill } from './fill'

/**
 * The public forms (section 12.1): the claim update form and the newsletter
 * sign-up, from the redesign. Both solve the captcha's proof-of-work
 * challenge in the browser before sending (D32), and carry an empty trap field
 * a person never sees.
 */

import type { SubmissionKind } from './submissionKind'

const FILE_LIMIT = { count: 3, bytes: 10 * 1024 * 1024 }
const FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

type Challenge = { challenge: string; difficulty: number; trapField: string }

const zeroBits = (bytes: Uint8Array): number => {
  let bits = 0
  for (const byte of bytes) {
    if (byte === 0) {
      bits += 8
      continue
    }
    return bits + Math.clz32(byte) - 24
  }
  return bits
}

/** Fetches a challenge and finds a nonce whose hash has enough leading zero bits. */
async function solveCaptcha(locale: string): Promise<{ token: string; trapField: string }> {
  const res = await fetch(`/api/v1/captcha?locale=${encodeURIComponent(locale)}`, {
    cache: 'no-store',
  })
  if (!res.ok) throw new Error('captcha')
  const { data } = (await res.json()) as { data: Challenge }
  const encoder = new TextEncoder()
  for (let nonce = 0; ; nonce++) {
    const token = `${data.challenge}.${nonce}`
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(token)))
    if (zeroBits(hash) >= data.difficulty) return { token, trapField: data.trapField }
  }
}

/** The field a bot fills and a person never sees. */
function Trap() {
  return (
    <div aria-hidden="true" className="sr-only">
      <label>
        Website
        <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
      </label>
    </div>
  )
}

async function send(path: string, form: FormData, locale: string): Promise<Response> {
  const { token, trapField } = await solveCaptcha(locale)
  form.set('captcha', token)
  form.set('locale', locale)
  if (!form.has(trapField)) form.set(trapField, '')
  return fetch(`/api/v1${path}`, { method: 'POST', body: form })
}

const label =
  'mb-2.5 block text-[10px] leading-none font-semibold tracking-[.14em] text-muted uppercase'
const field =
  'w-full rounded-lg border border-line bg-white px-[15px] py-[13px] text-[13.5px] leading-normal text-ink outline-none placeholder:text-subtle focus:border-ink'

export type UpdateContext = {
  claim: string
  actor: string
  where: string
  rating: string
}

const KINDS: SubmissionKind[] = ['evidence', 'correction', 'changed']

export function UpdateForm({
  strings: t,
  locale,
  country,
  claim,
  initialKind,
  initialWhere,
  context,
  claimHref,
  actorHref,
  privacyHref,
}: {
  strings: Strings
  locale: string
  country: string
  claim: string
  initialKind: SubmissionKind
  initialWhere: string
  context: UpdateContext
  claimHref: string
  actorHref: string
  privacyHref: string
}) {
  const [kind, setKind] = useState<SubmissionKind>(initialKind)
  const [files, setFiles] = useState<File[]>([])
  const [fileError, setFileError] = useState('')
  const [textError, setTextError] = useState(false)
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'failed' | 'limited'>('idle')
  const [reference, setReference] = useState('')
  const id = useId()

  const kinds = {
    evidence: [t.kindEvidence, t.kindEvidenceHint],
    correction: [t.kindCorrection, t.kindCorrectionHint],
    changed: [t.kindChanged, t.kindChangedHint],
  } as const

  function addFiles(list: FileList | null) {
    if (!list) return
    const fits: File[] = []
    const refused: string[] = []
    for (const file of Array.from(list)) {
      const ok =
        FILE_TYPES.includes(file.type) &&
        file.size <= FILE_LIMIT.bytes &&
        files.length + fits.length < FILE_LIMIT.count
      if (ok) fits.push(file)
      else refused.push(file.name)
    }
    setFiles((prev) => [...prev, ...fits])
    setFileError(refused.length ? fill(t.tooBig, { name: refused.join(', ') }) : '')
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    if (!String(form.get('text') ?? '').trim()) {
      setTextError(true)
      document.getElementById(`${id}-text`)?.focus()
      return
    }
    form.delete('files')
    for (const file of files) form.append('files', file)
    form.set('country', country)
    form.set('claim', claim)
    setStatus('sending')
    try {
      const res = await send('/submissions', form, locale)
      if (res.status === 429 || res.status === 403) {
        setStatus('limited')
        return
      }
      if (!res.ok) throw new Error(String(res.status))
      const body = (await res.json()) as { reference: string }
      setReference(body.reference)
      setStatus('sent')
      window.scrollTo({ top: 0 })
    } catch {
      setStatus('failed')
    }
  }

  if (status === 'sent') {
    const sent = new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date())
    return (
      <div className="grid max-w-[640px] gap-[22px]">
        <div role="status" className="rounded-lg bg-verified-bg px-6 py-[26px]">
          <div className="mb-3.5 flex items-center gap-2.5">
            <i aria-hidden="true" className="block size-[9px] rounded-full bg-verified" />
            <span className="text-[10px] leading-none font-medium tracking-[.14em] text-verified-ink uppercase">
              {t.received}
            </span>
          </div>
          <h1 className="mb-3 max-w-[26ch] text-[24px] leading-[1.25] font-semibold tracking-[-.02em]">
            {t.thanks}
          </h1>
          <p className="mb-4 max-w-[48ch] text-[14px] leading-[1.65] text-ink-2">{t.thanksBody}</p>
          <dl className="grid gap-[9px] border-t border-line pt-4 text-[12.5px] leading-normal">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-2">{t.reference}</dt>
              <dd className="font-medium">{reference}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-2">{t.sent}</dt>
              <dd className="font-medium">{sent}</dd>
            </div>
          </dl>
          <p className="mt-4 text-[12px] leading-[1.6] text-ink-2">{t.noEta}</p>
        </div>
        <div>
          <Link
            href={claimHref}
            className="inline-block rounded-lg bg-ink px-6 py-4 text-[12px] leading-none font-medium tracking-[.06em] text-white uppercase hover:text-white hover:opacity-85"
          >
            {t.backToClaim}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="relative grid items-start gap-[52px] md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]"
    >
      <Trap />
      <div>
        <h1 className="mb-3.5 max-w-[24ch] text-[28px] leading-[1.12] font-semibold tracking-[-.014em] sm:text-[34px]">
          {t.seen}
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
                  'cursor-pointer rounded-lg border px-4 py-3.5 text-[12.5px] leading-[1.4] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-verified/40',
                  kind === k
                    ? 'border-verified bg-verified-bg font-medium text-verified-ink'
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
                {kinds[k][0]}
                {'  '}
                <span className="font-normal text-muted">{kinds[k][1]}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="rounded-lg bg-surface px-5 py-[18px]">
          <div className={label}>{t.attached}</div>
          <dl className="grid gap-[9px] text-[12.5px] leading-normal text-ink-2">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">{t.attachedClaim}</dt>
              <dd className="text-right font-medium">{context.claim}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">{t.attachedActor}</dt>
              <dd className="text-right font-medium">
                <Link href={actorHref} className="text-ink-2 hover:text-ink">
                  {context.actor}
                </Link>
              </dd>
            </div>
            {context.where && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted">{t.attachedWhere}</dt>
                <dd className="text-right font-medium">{context.where}</dd>
              </div>
            )}
            {context.rating && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted">{t.attachedRating}</dt>
                <dd className="text-right font-medium">{context.rating}</dd>
              </div>
            )}
          </dl>
          <p className="mt-3.5 text-[12px] leading-[1.6] text-ink-2">{t.attachedNote}</p>
        </div>
      </div>

      <div>
        {files.length > 0 && (
          <ul className="mb-4 grid gap-2">
            {files.map((file, i) => (
              <li
                key={`${file.name}-${file.size}-${file.lastModified}`}
                className="flex items-center gap-3.5 rounded-lg border border-verified bg-verified-bg px-[18px] py-4"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] leading-[1.4] font-medium">
                    {file.name}
                  </span>
                  <span className="text-[11px] leading-normal text-ink-2 uppercase">
                    {Math.max(1, Math.round(file.size / 1024))} KB
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                  aria-label={fill(t.removeFile, { name: file.name })}
                  className="cursor-pointer text-[13px] leading-none text-muted hover:text-ink"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        <label className="mb-5 block cursor-pointer rounded-lg border border-dashed border-verified bg-white px-[18px] py-4 text-center hover:bg-verified-bg has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-verified/40">
          <input
            type="file"
            multiple
            accept={FILE_TYPES.join(',')}
            className="sr-only"
            onChange={(e) => {
              addFiles(e.target.files)
              e.target.value = ''
            }}
          />
          <span className="block text-[13px] leading-normal font-medium text-verified-ink">
            {t.addFile}
          </span>
          <span className="mt-[3px] block text-[11px] leading-[1.6] text-ink-2 uppercase">
            {t.upTo}
          </span>
        </label>
        {fileError && <p className="-mt-3 mb-5 text-[12.5px] text-r-stalled">{fileError}</p>}

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
          aria-describedby={textError ? `${id}-text-err` : undefined}
          onChange={() => textError && setTextError(false)}
          className={cn(
            field,
            'mb-1 resize-y text-[14px] leading-[1.6]',
            textError ? 'border-r-stalled' : 'border-ink',
          )}
        />
        <p
          id={`${id}-text-err`}
          className={cn('mb-5 min-h-4 text-[12.5px] text-r-stalled', !textError && 'invisible')}
        >
          {t.whatSawRequired}
        </p>

        <label htmlFor={`${id}-where`} className={label}>
          {t.whereSpecific}
        </label>
        <input
          id={`${id}-where`}
          name="location"
          maxLength={300}
          defaultValue={initialWhere}
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
          name="link"
          type="url"
          maxLength={300}
          placeholder="https://"
          className={cn(field, 'mb-5')}
        />

        <label htmlFor={`${id}-name`} className={label}>
          {t.yourName}
        </label>
        <input
          id={`${id}-name`}
          name="name"
          maxLength={300}
          autoComplete="name"
          className={cn(field, 'mb-2.5')}
        />
        <label className="mb-5 flex items-center gap-2 text-[12.5px] text-ink-2">
          <input type="checkbox" name="consent" value="true" />
          {t.creditMe}
        </label>

        <label htmlFor={`${id}-contact`} className={label}>
          {t.reach}
        </label>
        <input
          id={`${id}-contact`}
          name="contact"
          maxLength={300}
          autoComplete="email"
          placeholder={t.reachPlaceholder}
          className={cn(field, 'mb-2.5')}
        />
        <p className="mb-[22px] text-[12px] leading-[1.6] text-ink-2">
          {t.reachNote}{' '}
          <Link href={privacyHref} className="underline">
            {t.privacy}
          </Link>
        </p>

        {(status === 'failed' || status === 'limited') && (
          <p role="alert" className="mb-4 text-[12.5px] text-r-stalled">
            {status === 'limited' ? t.tooMany : t.formFailed}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={status === 'sending'}
            className="cursor-pointer rounded-lg bg-verified px-6 py-4 text-[12px] leading-none font-medium tracking-[.06em] text-white uppercase hover:opacity-85 disabled:cursor-wait disabled:opacity-60"
          >
            {status === 'sending' ? t.sending : t.send}
          </button>
          <span className="text-[11px] leading-[1.6] tracking-[.05em] text-muted uppercase">
            {t.noAccount}
          </span>
        </div>
      </div>
    </form>
  )
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** The footer's newsletter sign-up. */
export function SubscribeForm({
  strings: t,
  locale,
  privacyHref,
}: {
  strings: Strings
  locale: string
  privacyHref: string
}) {
  const [status, setStatus] = useState<'idle' | 'invalid' | 'sending' | 'done' | 'failed'>('idle')

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    if (!EMAIL.test(String(form.get('email') ?? '').trim())) {
      setStatus('invalid')
      return
    }
    setStatus('sending')
    try {
      const res = await send('/subscriptions', form, locale)
      setStatus(res.ok ? 'done' : 'failed')
    } catch {
      setStatus('failed')
    }
  }

  if (status === 'done') {
    return (
      <p role="status" className="text-[14px] leading-normal text-verified-ink">
        {t.subscribeDone}
      </p>
    )
  }

  const problem =
    status === 'invalid' ? t.subscribeInvalid : status === 'failed' ? t.formFailed : ''
  return (
    <form onSubmit={onSubmit} noValidate className="relative grid w-full max-w-[340px] gap-2">
      <Trap />
      <div className="flex items-center gap-2 rounded-full border border-line-2 bg-surface py-1 pr-1 pl-5 focus-within:border-ink">
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
          aria-describedby={problem ? 'subscribe-error' : undefined}
          onChange={() => status === 'invalid' && setStatus('idle')}
          className="min-w-0 flex-1 bg-transparent text-[14px] leading-none text-ink outline-none placeholder:text-faint"
        />
        <button
          type="submit"
          disabled={status === 'sending'}
          className="flex-none cursor-pointer rounded-full bg-ink px-[22px] py-[13px] text-[14px] leading-none font-semibold text-white hover:opacity-85 disabled:cursor-wait disabled:opacity-60"
        >
          {t.subscribe}
        </button>
      </div>
      {problem && (
        <p id="subscribe-error" className="pl-5 text-[12.5px] leading-snug text-r-stalled">
          {problem}
        </p>
      )}
      <Link href={privacyHref} className="pl-5 text-[12px] text-muted underline">
        {t.privacy}
      </Link>
    </form>
  )
}
