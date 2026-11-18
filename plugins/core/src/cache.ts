import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, PayloadRequest } from 'payload'

import { afterCommit } from './afterCommit'

/**
 * Refreshes the public site's cached pages (section 17, D47). A record type
 * names the tags a change touches, and the app sets how they reach the site,
 * with `setTagRefresher`. Until it does, nothing is refreshed.
 */
export type TagRefresher = (tags: readonly string[], req: PayloadRequest) => Promise<void>

let refresher: TagRefresher = async () => {}

export function setTagRefresher(next: TagRefresher): void {
  refresher = next
}

/**
 * Refreshes tags once the save commits. Refreshing before would let a visitor
 * arriving in between cache the page again with the old data, since the web
 * process reads on another connection and cannot see an uncommitted save.
 */
export function refreshTags(tags: readonly string[], req: PayloadRequest): Promise<void> {
  return afterCommit(req, () => refresher(tags, req))
}

/**
 * Set in a save's context to skip the refresh, when the operation that started
 * the save refreshes once at the end, such as filling a country's names.
 */
export const SKIP_REFRESH = 'promisetracker:skipRefresh'

/** Hooks that refresh the tags a record belongs to, after a save and after a delete. */
export function refreshOnChange<T>(tagsFor: (doc: T) => readonly string[]): {
  afterChange: CollectionAfterChangeHook
  afterDelete: CollectionAfterDeleteHook
} {
  return {
    afterChange: async ({ doc, previousDoc, req, context }) => {
      if (context[SKIP_REFRESH]) return doc
      const tags = new Set([
        ...tagsFor(doc as T),
        ...(previousDoc ? tagsFor(previousDoc as T) : []),
      ])
      await refreshTags([...tags], req)
      return doc
    },
    afterDelete: async ({ doc, req }) => {
      await refreshTags(tagsFor(doc as T), req)
      return doc
    },
  }
}
