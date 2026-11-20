import type { Payload, Where } from 'payload'

/** Claims waiting for a verdict, not archived (section 5.1). */
export const AWAITING_VERIFICATION: Where = {
  and: [
    { 'verification.verdict': { equals: 'unverified' } },
    { recordStatus: { not_equals: 'archived' } },
  ],
}

export const VERIFICATION_QUEUE = 'Awaiting verification'

/**
 * A query as the admin's list view reads it from its address, such as
 * `where[and][0][verification.verdict][equals]=unverified`.
 */
export function whereToQuery(where: Where, prefix = 'where'): string {
  const parts: string[] = []
  const walk = (value: unknown, path: string) => {
    if (value && typeof value === 'object') {
      for (const [key, inner] of Object.entries(value)) walk(inner, `${path}[${key}]`)
    } else {
      parts.push(`${path}=${encodeURIComponent(String(value))}`)
    }
  }
  walk(where, prefix)
  return parts.join('&')
}

/**
 * The saved view reviewers work from (section 5.1): claims with no verdict,
 * not archived. Shared with everyone, and created at start-up when missing.
 * Nobody but the system changes or deletes it, so it is always there.
 */
export async function ensureVerificationQueue(payload: Payload): Promise<void> {
  // The query presets collection is Payload's own, typed by the app, so its
  // slug is cast here.
  const collection = 'payload-query-presets' as never
  const { totalDocs } = await payload.count({
    collection,
    where: {
      and: [{ title: { equals: VERIFICATION_QUEUE } }, { relatedCollection: { equals: 'claims' } }],
    },
    // Start-up checks run as the system.
    overrideAccess: true,
  })
  if (totalDocs > 0) return
  try {
    await create(payload, collection)
  } catch (error) {
    // Two servers starting together may both find none. One creates it, and
    // the other's create fails or makes a second, which the count shows.
    const again = await payload.count({
      collection,
      where: { title: { equals: VERIFICATION_QUEUE } },
      overrideAccess: true,
    })
    if (again.totalDocs === 0) throw error
  }
}

async function create(payload: Payload, collection: never): Promise<void> {
  await payload.create({
    collection,
    data: {
      title: VERIFICATION_QUEUE,
      relatedCollection: 'claims',
      isShared: true,
      // The admin saves its filters in this shape: any of a list of all-of groups.
      where: { or: [AWAITING_VERIFICATION] },
      columns: [
        { accessor: 'title', active: true },
        { accessor: 'actor', active: true },
        { accessor: 'topic', active: true },
        { accessor: 'createdAt', active: true },
      ],
      access: {
        read: { constraint: 'everyone' },
        update: { constraint: 'specificUsers', users: [] },
        delete: { constraint: 'specificUsers', users: [] },
      },
    } as never,
    // Start-up checks run as the system.
    overrideAccess: true,
  })
}
