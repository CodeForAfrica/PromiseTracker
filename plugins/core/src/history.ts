import type { Config, Field } from 'payload'
import { createCreatedByField, createUpdatedByField } from 'payload'

import { signedIn } from './access'

type Authorship = NonNullable<Config['collections']>[number]['authorship']

const tracks = (authorship: Authorship, key: 'createdBy' | 'updatedBy'): boolean =>
  authorship === false ? false : typeof authorship === 'object' ? authorship[key] !== false : true

const named = (fields: readonly Field[], name: string): boolean =>
  fields.some((field) => 'name' in field && field.name === name)

/**
 * Payload adds `createdBy` and `updatedBy` to every record type. Defining them
 * here keeps Payload's own behaviour and adds one rule: only signed-in users
 * read them.
 */
function withPrivateAuthorship(fields: readonly Field[], authorship: Authorship): Field[] {
  const read = { access: { read: signedIn } }
  // A plugin may define these fields itself, to relabel or show them. Its
  // version keeps everything but the read rule, which is always this one.
  const closed = fields.map((field): Field => {
    if (!('name' in field) || (field.name !== 'createdBy' && field.name !== 'updatedBy')) {
      return field
    }
    const own = field as Field & { access?: Record<string, unknown> }
    return { ...own, access: { ...own.access, read: signedIn } } as Field
  })
  return [
    ...closed,
    ...(tracks(authorship, 'createdBy') && !named(fields, 'createdBy')
      ? [createCreatedByField({ overrides: read })]
      : []),
    ...(tracks(authorship, 'updatedBy') && !named(fields, 'updatedBy')
      ? [createUpdatedByField({ overrides: read })]
      : []),
  ]
}

/**
 * The one setting that keeps staff identities private (sections 8.5 and 13.6):
 * on every record type and global, from every plugin, version history and the
 * created-by and changed-by fields are readable by signed-in users only.
 *
 * Payload's default lets anyone who can read a record read its versions, so a
 * public record would have a public history. This runs after every other
 * plugin, so nothing added later escapes it.
 */
export function privateHistory(config: Config): Config {
  return {
    ...config,
    collections: (config.collections ?? []).map((collection) => ({
      ...collection,
      access: { ...collection.access, readVersions: signedIn },
      fields: withPrivateAuthorship(collection.fields, collection.authorship),
    })),
    globals: (config.globals ?? []).map((global) => ({
      ...global,
      access: { ...global.access, readVersions: signedIn },
      fields: withPrivateAuthorship(global.fields, global.authorship),
    })),
  }
}
