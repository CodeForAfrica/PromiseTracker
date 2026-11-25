import { isSuperAdmin } from '@promisetracker/kernel'
import type { FieldAccess, FieldHook, TextField } from 'payload'

/**
 * A plugin credential in the settings global (sections 7.10 and 13.7), from
 * v2's `src/fields/encryptedSecret.ts`. It is encrypted with PAYLOAD_SECRET on
 * save, shown as a mask, and kept as it was when a form is saved without
 * retyping it.
 */

export const ENCRYPTED_PREFIX = 'enc:v1:'
export const SECRET_MASK = '********'

export const isEncrypted = (value: unknown): value is string =>
  typeof value === 'string' && value.startsWith(ENCRYPTED_PREFIX)

const superAdminOnly: FieldAccess = ({ req }) => isSuperAdmin(req.user)

type HookArgs = Parameters<FieldHook>[0]

/**
 * What the database holds for this field. A person's save hands the hook the
 * value as they read it, which is the mask, so the stored one is read again,
 * without hooks.
 */
async function storedValue({ collection, global, originalDoc, path, req }: HookArgs) {
  let doc: unknown = null
  if (global) {
    doc = await req.payload.db.findGlobal({ slug: global.slug, req })
  } else if (collection && originalDoc && 'id' in originalDoc) {
    doc = await req.payload.db.findOne({
      collection: collection.slug,
      where: { id: { equals: originalDoc.id } },
      req,
    })
  }
  let value: unknown = doc
  for (const key of path) {
    value = value && typeof value === 'object' ? Reflect.get(value, key) : undefined
  }
  // Never undefined: Payload would then keep the incoming value, which is the mask.
  return value ?? null
}

const encryptOnSave: FieldHook = async (args) => {
  const { value, previousValue, req } = args
  // The mask came back from a form nobody retyped: keep what is stored.
  if (value === SECRET_MASK) {
    return isEncrypted(previousValue) ? previousValue : await storedValue(args)
  }
  if (typeof value !== 'string' || value === '' || isEncrypted(value)) return value
  return `${ENCRYPTED_PREFIX}${req.payload.encrypt(value)}`
}

/**
 * Only the system's own reads see the value: the kernel reads settings through
 * the local API with no user. Everyone else, the admin included, sees the
 * mask. Payload's admin also reads through the local API, so the API alone
 * cannot tell them apart, which v2's field relied on.
 */
const decryptForSystem: FieldHook = ({ value, req }) => {
  if (typeof value !== 'string' || value === '') return value
  if (req.payloadAPI !== 'local' || req.user) return SECRET_MASK
  return isEncrypted(value) ? req.payload.decrypt(value.slice(ENCRYPTED_PREFIX.length)) : value
}

type SingleTextField = Extract<TextField, { hasMany?: false | undefined }>

/** A text field whose value is encrypted at rest and never shown. Super-admins alone change it. */
export const encryptedSecretField = (
  field: Omit<SingleTextField, 'type' | 'hooks' | 'access'> & {
    hooks?: SingleTextField['hooks']
  },
): TextField => ({
  ...field,
  type: 'text',
  access: { create: superAdminOnly, read: superAdminOnly, update: superAdminOnly },
  ...(field.validate
    ? {
        // The mask is what an untouched form sends back, so it is not checked
        // again. Payload checks a field after its hooks, so an encrypted value
        // is decrypted first and the address itself is checked.
        validate: (value, options) => {
          if (value === SECRET_MASK) return true
          const plain = isEncrypted(value)
            ? options.req.payload.decrypt(value.slice(ENCRYPTED_PREFIX.length))
            : value
          return field.validate?.(plain, options) ?? true
        },
      }
    : {}),
  hooks: {
    ...field.hooks,
    beforeChange: [...(field.hooks?.beforeChange ?? []), encryptOnSave],
    afterRead: [...(field.hooks?.afterRead ?? []), decryptForSystem],
  },
})
