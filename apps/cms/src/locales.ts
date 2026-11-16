import type { LocaleSpec } from '@promisetracker/kernel'

/**
 * Every language PromiseTracker can run in (section 7.1, D45). The database
 * stores this list, so adding one here needs a migration. PT_LOCALES chooses
 * which of them a deployment uses, and never changes the schema.
 */
export const registeredLocales = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'pt', label: 'Português' },
  { code: 'ar', label: 'العربية', rtl: true },
  { code: 'sw', label: 'Kiswahili' },
] as const satisfies readonly LocaleSpec[]

export const defaultLocale = 'en'
