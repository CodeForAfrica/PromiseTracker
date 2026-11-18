/** A language PromiseTracker can run in (section 7.1). */
export type RegisteredLocale = { code: string; label: string; rtl?: boolean }

/**
 * Every language PromiseTracker can run in (section 7.1, D45). The database
 * stores this list, so adding one here needs a migration. PT_LOCALES chooses
 * which of them a deployment uses, and never changes the schema.
 */
export const REGISTERED_LOCALES = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'pt', label: 'Português' },
  { code: 'ar', label: 'العربية', rtl: true },
  { code: 'sw', label: 'Kiswahili' },
] as const satisfies readonly RegisteredLocale[]

export type LocaleCode = (typeof REGISTERED_LOCALES)[number]['code']

export const DEFAULT_LOCALE: LocaleCode = 'en'

export const isLocaleCode = (value: unknown): value is LocaleCode =>
  REGISTERED_LOCALES.some((l) => l.code === value)
