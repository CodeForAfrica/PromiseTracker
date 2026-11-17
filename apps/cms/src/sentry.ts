import { isDeveloperError, redact } from '@promisetracker/kernel'
import type { ErrorEvent, EventHint } from '@sentry/nextjs'

type Env = Readonly<Record<string, string | undefined>>
type Sentry = typeof import('@sentry/nextjs')

// Loaded only once a Sentry address is set, so without one the core runs with
// no outside service and never loads the SDK.
let sentry: Sentry | null = null

/**
 * Only problems a developer can fix reach Sentry (section 14), and never with
 * keys, tokens, passwords, email or network addresses (section 13.7).
 */
export function beforeSend(event: ErrorEvent, hint: EventHint): ErrorEvent | null {
  if (!isDeveloperError(hint.originalException)) return null
  return redact(event) as ErrorEvent
}

/** Starts Sentry when SENTRY_DSN is set. Returns whether it started. */
export async function startSentry(env: Env = process.env): Promise<boolean> {
  const dsn = env.SENTRY_DSN?.trim()
  if (!dsn) return false
  if (sentry) return true
  const sdk = await import('@sentry/nextjs')
  sdk.init({
    dsn,
    environment: env.SENTRY_ENVIRONMENT?.trim() || env.NODE_ENV || 'development',
    // Collect nothing beyond the error and its stack. Users, cookies, headers,
    // bodies, query values and local variables can all hold personal data or
    // keys, and beforeSend cleans whatever is left.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false },
      mcp: { inputs: false, outputs: false },
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
      // Source lines around each frame can quote anything, so only file and line are sent.
      frameContextLines: 0,
    },
    // Errors only. Performance tracing is not used.
    tracesSampleRate: 0,
    beforeSend,
    beforeBreadcrumb: (breadcrumb) => redact(breadcrumb) as typeof breadcrumb,
  })
  sentry = sdk
  return true
}

/** Sends an error to Sentry if it is one a developer must fix. Does nothing while Sentry is off. */
export function reportError(error: unknown, context: Record<string, unknown> = {}): void {
  if (!sentry || !isDeveloperError(error)) return
  sentry.captureException(error, { extra: redact(context) as Record<string, unknown> })
}

/** Next.js's `onRequestError`: an error thrown while rendering a page or running a route. */
export async function captureRequestError(
  ...args: Parameters<Sentry['captureRequestError']>
): Promise<void> {
  if (!sentry) return
  sentry.captureRequestError(...args)
}
