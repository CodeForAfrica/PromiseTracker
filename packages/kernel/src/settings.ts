import type { Payload } from 'payload'

export const SETTINGS_GLOBAL = 'settings'

/**
 * How long a process reuses the settings it read. A save in this process
 * clears them at once (see `forgetSettings`). Another process, such as the
 * worker, cannot see that save, so it reads again after this long.
 */
export const SETTINGS_TTL_MS = 30_000

type Settings = Readonly<Record<string, unknown>>
type GlobalSlugParam = Parameters<Payload['findGlobal']>[0]['slug']

const cache = new WeakMap<Payload, { at: number; value: Promise<Settings> }>()

/**
 * Every plugin's settings, read once and reused, so an adapter call does not
 * cost a database read (section 7.10).
 */
export function readSettings(payload: Payload, now: number = Date.now()): Promise<Settings> {
  // The settings global exists only once a plugin declares settings.
  const globalSlugs: readonly string[] = payload.config.globals.map((g) => g.slug)
  if (!globalSlugs.includes(SETTINGS_GLOBAL)) return Promise.resolve({})

  const cached = cache.get(payload)
  if (cached && now - cached.at < SETTINGS_TTL_MS) return cached.value

  // The kernel cannot see the app's generated global names, so it names this
  // one through Payload's own parameter type. Settings hold credentials, and
  // the kernel reads them as the system.
  const value = payload
    .findGlobal({ slug: SETTINGS_GLOBAL as GlobalSlugParam, overrideAccess: true })
    .then((doc: unknown): Settings => (doc && typeof doc === 'object' ? (doc as Settings) : {}))
  cache.set(payload, { at: now, value })
  // A failed read is not kept, so the next call tries again.
  value.catch(() => {
    if (cache.get(payload)?.value === value) cache.delete(payload)
  })
  return value
}

/** Drops the settings this process holds, so the next read goes to the database. */
export function forgetSettings(payload: Payload): void {
  cache.delete(payload)
}
