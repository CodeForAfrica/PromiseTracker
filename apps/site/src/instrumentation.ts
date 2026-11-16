/**
 * Runs once when the server starts, before it takes traffic. Starting Payload
 * here applies pending migrations in production and, in the worker, starts the
 * job runner. See section 16.1 of the system specification.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.NODE_ENV !== 'production' && process.env.PT_ROLE !== 'worker') return
  const { getPayload } = await import('@promisetracker/cms')
  await getPayload()
}
