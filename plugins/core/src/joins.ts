import type { CollapsibleField, JoinField } from 'payload'

import { signedIn } from './access'

type Options = {
  name: string
  label: string
  /** The record type that points here. */
  collection: string
  /** Its relationship field that points here. */
  on: string
  columns: readonly string[]
  defaultSort?: string
  /** Shown only when this holds, such as for an actor of kind party. */
  condition?: (data: Record<string, unknown>) => boolean
}

/**
 * Records that point at this one, listed on its edit page: an actor's terms,
 * an office's holders. Nothing is stored twice: it reads the other record
 * type's relationship field.
 *
 * Only signed-in users read it. Guests get the public API's fields and no
 * more (D46), and the public API asks for no joins.
 */
export function related(options: Options): JoinField {
  return {
    name: options.name,
    label: options.label,
    type: 'join',
    // Payload types collection slugs from the app's generated types, which a
    // plugin cannot see, so the slug is cast.
    collection: options.collection as JoinField['collection'],
    on: options.on,
    defaultLimit: 10,
    ...(options.defaultSort ? { defaultSort: options.defaultSort } : {}),
    maxDepth: 1,
    access: { read: signedIn },
    admin: {
      defaultColumns: [...options.columns],
      ...(options.condition ? { condition: options.condition } : {}),
    },
  }
}

/** The related lists, folded away so the form stays short. */
export function relatedSection(...fields: JoinField[]): CollapsibleField {
  return {
    type: 'collapsible',
    label: 'Related',
    admin: {
      initCollapsed: true,
      // A new record has nothing pointing at it yet.
      condition: (data) => Boolean(data?.id),
    },
    fields,
  }
}
