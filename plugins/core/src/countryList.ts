import type { LocaleCode } from './locales'
import { REGISTERED_LOCALES } from './locales'

export const REGIONS = [
  'east-africa',
  'west-africa',
  'central-africa',
  'southern-africa',
  'north-africa',
] as const
export type Region = (typeof REGIONS)[number]

type Known = { region: Region; languages: readonly LocaleCode[] }

/**
 * The 54 African countries, with the region an editor would file each under
 * and the languages it would usually publish in, from those PromiseTracker
 * runs in. Regions follow the United Nations' grouping (M49), with Middle
 * Africa called central. Languages are each country's official languages,
 * or the one most used in public life where none of ours is official.
 * Editors can change both on the country.
 */
export const COUNTRY_LIST = {
  // North Africa
  dz: { region: 'north-africa', languages: ['ar', 'fr'] },
  eg: { region: 'north-africa', languages: ['ar'] },
  ly: { region: 'north-africa', languages: ['ar'] },
  ma: { region: 'north-africa', languages: ['ar', 'fr'] },
  sd: { region: 'north-africa', languages: ['ar', 'en'] },
  tn: { region: 'north-africa', languages: ['ar', 'fr'] },
  // East Africa
  bi: { region: 'east-africa', languages: ['fr', 'en'] },
  km: { region: 'east-africa', languages: ['fr', 'ar'] },
  dj: { region: 'east-africa', languages: ['fr', 'ar'] },
  er: { region: 'east-africa', languages: ['en', 'ar'] },
  et: { region: 'east-africa', languages: ['en'] },
  ke: { region: 'east-africa', languages: ['en', 'sw'] },
  mg: { region: 'east-africa', languages: ['fr'] },
  mw: { region: 'east-africa', languages: ['en'] },
  mu: { region: 'east-africa', languages: ['en', 'fr'] },
  mz: { region: 'east-africa', languages: ['pt'] },
  rw: { region: 'east-africa', languages: ['en', 'fr', 'sw'] },
  sc: { region: 'east-africa', languages: ['en', 'fr'] },
  so: { region: 'east-africa', languages: ['ar'] },
  ss: { region: 'east-africa', languages: ['en'] },
  tz: { region: 'east-africa', languages: ['sw', 'en'] },
  ug: { region: 'east-africa', languages: ['en', 'sw'] },
  zm: { region: 'east-africa', languages: ['en'] },
  zw: { region: 'east-africa', languages: ['en'] },
  // Central Africa
  ao: { region: 'central-africa', languages: ['pt'] },
  cm: { region: 'central-africa', languages: ['fr', 'en'] },
  cf: { region: 'central-africa', languages: ['fr'] },
  td: { region: 'central-africa', languages: ['fr', 'ar'] },
  cg: { region: 'central-africa', languages: ['fr'] },
  cd: { region: 'central-africa', languages: ['fr'] },
  gq: { region: 'central-africa', languages: ['fr', 'pt'] },
  ga: { region: 'central-africa', languages: ['fr'] },
  st: { region: 'central-africa', languages: ['pt'] },
  // Southern Africa
  bw: { region: 'southern-africa', languages: ['en'] },
  sz: { region: 'southern-africa', languages: ['en'] },
  ls: { region: 'southern-africa', languages: ['en'] },
  na: { region: 'southern-africa', languages: ['en'] },
  za: { region: 'southern-africa', languages: ['en'] },
  // West Africa
  bj: { region: 'west-africa', languages: ['fr'] },
  bf: { region: 'west-africa', languages: ['fr'] },
  cv: { region: 'west-africa', languages: ['pt'] },
  ci: { region: 'west-africa', languages: ['fr'] },
  gm: { region: 'west-africa', languages: ['en'] },
  gh: { region: 'west-africa', languages: ['en'] },
  gn: { region: 'west-africa', languages: ['fr'] },
  gw: { region: 'west-africa', languages: ['pt'] },
  lr: { region: 'west-africa', languages: ['en'] },
  ml: { region: 'west-africa', languages: ['fr'] },
  mr: { region: 'west-africa', languages: ['ar', 'fr'] },
  ne: { region: 'west-africa', languages: ['fr'] },
  ng: { region: 'west-africa', languages: ['en'] },
  sn: { region: 'west-africa', languages: ['fr'] },
  sl: { region: 'west-africa', languages: ['en'] },
  tg: { region: 'west-africa', languages: ['fr'] },
} as const satisfies Record<string, Known>

export type CountryCode = keyof typeof COUNTRY_LIST

export const COUNTRY_CODES = Object.keys(COUNTRY_LIST) as CountryCode[]

export const isCountryCode = (value: unknown): value is CountryCode =>
  typeof value === 'string' && Object.hasOwn(COUNTRY_LIST, value)

/**
 * Names where the standard ones, which Node takes from Unicode's data, read
 * oddly on a page, such as "Congo - Kinshasa".
 */
const NAME_OVERRIDES: Partial<Record<CountryCode, Partial<Record<LocaleCode, string>>>> = {
  cd: {
    en: 'Democratic Republic of the Congo',
    fr: 'République démocratique du Congo',
    pt: 'República Democrática do Congo',
    ar: 'جمهورية الكونغو الديمقراطية',
    sw: 'Jamhuri ya Kidemokrasia ya Kongo',
  },
  cg: {
    en: 'Republic of the Congo',
    fr: 'République du Congo',
    pt: 'República do Congo',
    ar: 'جمهورية الكونغو',
    sw: 'Jamhuri ya Kongo',
  },
  st: { en: 'São Tomé and Príncipe' },
}

/** A country's standard name in a language. */
export function countryName(code: CountryCode, locale: LocaleCode): string {
  const override = NAME_OVERRIDES[code]?.[locale]
  if (override) return override
  return new Intl.DisplayNames([locale], { type: 'region' }).of(code.toUpperCase()) ?? code
}

/** A country's standard name in every registered language. */
export function countryNames(code: CountryCode): Record<LocaleCode, string> {
  return Object.fromEntries(
    REGISTERED_LOCALES.map((l) => [l.code, countryName(code, l.code)]),
  ) as Record<LocaleCode, string>
}

/** What the country list knows about a country, to fill in a new record. */
export function countryDefaults(code: CountryCode): {
  region: Region
  languages: LocaleCode[]
  defaultLanguage: LocaleCode
} {
  const { region, languages } = COUNTRY_LIST[code]
  const [first] = languages
  return { region, languages: [...languages], defaultLanguage: first ?? 'en' }
}
