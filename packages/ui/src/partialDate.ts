import type { PartialDate } from '@promisetracker/contract'

/** "2027", "August 2027" or "9 August 2027", as precise as the date is. */
export function formatPartialDate(locale: string, date: PartialDate): string {
  const when = new Date(`${date.value.padEnd(10, '-01').slice(0, 10)}T00:00:00Z`)
  const parts: Intl.DateTimeFormatOptions =
    date.precision === 'year'
      ? { year: 'numeric' }
      : date.precision === 'month'
        ? { year: 'numeric', month: 'long' }
        : { year: 'numeric', month: 'long', day: 'numeric' }
  return new Intl.DateTimeFormat(locale, { ...parts, timeZone: 'UTC' }).format(when)
}
