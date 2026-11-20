import type { Payload } from 'payload'

import { AWAITING_VERIFICATION } from './widgets'

export const VERIFICATION_QUEUE = 'Awaiting verification'

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
