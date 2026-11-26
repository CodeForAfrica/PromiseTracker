'use client'

import { FieldDescription, TextInput, useField, useLocale } from '@payloadcms/ui'
import type { StringKey } from '@promisetracker/contract'
import { STRING_KEYS } from '@promisetracker/contract'
import type { JSONFieldClientProps } from 'payload'

import { DEFAULT_STRINGS } from './strings'

/**
 * The interface text, one box per string (section 10.5). It is saved as one
 * value per language, since a column per string would pass the hundred a
 * Postgres query may name (D109). Payload loads it by path,
 * `@promisetracker/plugin-site/client#InterfaceText`.
 */

/** `skipToContent` reads as "Skip to content". */
const labelOf = (key: string): string => {
  const words = key.replace(/([A-Z])/g, ' $1').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

const asRecord = (value: unknown): Partial<Record<StringKey, string>> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Partial<Record<StringKey, string>>)
    : {}

export function InterfaceText({ path, readOnly }: JSONFieldClientProps) {
  const { value, setValue } = useField<Partial<Record<StringKey, string>> | null>({ path })
  const locale = useLocale()
  const defaults = locale?.code === 'fr' ? DEFAULT_STRINGS.fr : DEFAULT_STRINGS.en
  const saved = asRecord(value)
  const change = (key: StringKey, next: string) => {
    const updated = { ...saved }
    // An empty box uses the default, so it is not saved.
    if (next.trim()) updated[key] = next
    else delete updated[key]
    setValue(Object.keys(updated).length > 0 ? updated : null)
  }
  return (
    <div className="field-type">
      <FieldDescription
        path={path}
        description="Leave a box empty to use the default shown in it."
      />
      {STRING_KEYS.map((key) => (
        <TextInput
          key={key}
          path={`${path}.${key}`}
          label={labelOf(key)}
          value={saved[key] ?? ''}
          placeholder={defaults[key]}
          readOnly={Boolean(readOnly)}
          onChange={(event: { target: { value: string } }) => change(key, event.target.value)}
        />
      ))}
    </div>
  )
}
