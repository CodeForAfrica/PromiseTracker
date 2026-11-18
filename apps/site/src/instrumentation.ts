import type { Instrumentation } from 'next'

/**
 * Runs once when the server starts, before it takes traffic. Sentry starts
 * first, when SENTRY_DSN is set, so start-up errors reach it. Starting Payload
 * here applies pending migrations in production, one replica at a time, and in
 * the worker starts the job runner. See section 16.1 of the system
 * specification.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { startSentry } = await import('@promisetracker/cms/sentry')
  await startSentry()
  if (process.env.NODE_ENV !== 'production' && process.env.PT_ROLE !== 'worker') return
  const { startPayload } = await import('@promisetracker/cms')
  await startPayload()
}

/** Errors thrown while rendering a page or running a route. Sentry filters and cleans them. */
export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || !process.env.SENTRY_DSN) return
  const { captureRequestError } = await import('@promisetracker/cms/sentry')
  await captureRequestError(...args)
}
