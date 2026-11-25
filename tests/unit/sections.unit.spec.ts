import {
  analysisRule,
  chooseCountry,
  closingRule,
  inFocusRule,
  listRule,
  pastRule,
  peopleRule,
  shows,
} from '@promisetracker/ui'
import { describe, expect, it } from 'vitest'

/**
 * Every rule in section 10.3: a section with nothing to show is left out,
 * and an editor can force one on or off. Forced on, it still never shows
 * empty.
 */
describe('when a section shows (section 10.3)', () => {
  const auto = {}

  describe('who is delivering and officials', () => {
    it('show with two or more current office holders', () => {
      expect(shows('country.who-is-delivering', auto, peopleRule(2))).toBe(true)
      expect(shows('country.officials', auto, peopleRule(5))).toBe(true)
    })

    it('are left out with one, when the page leads with that office holder, or none', () => {
      expect(shows('country.who-is-delivering', auto, peopleRule(1))).toBe(false)
      expect(shows('country.officials', auto, peopleRule(1))).toBe(false)
      expect(shows('country.officials', auto, peopleRule(0))).toBe(false)
    })
  })

  describe('choose a country', () => {
    it('is a list with two or more countries', () => {
      expect(chooseCountry(auto, 2)).toBe('list')
    })

    it('is a single link with one, and left out with none', () => {
      expect(chooseCountry(auto, 1)).toBe('link')
      expect(chooseCountry(auto, 0)).toBeNull()
    })

    it('follows an editor: forced on, one country is a list; forced off, it is gone', () => {
      expect(chooseCountry({ 'home.choose-country': 'on' }, 1)).toBe('list')
      expect(chooseCountry({ 'home.choose-country': 'off' }, 3)).toBeNull()
      expect(chooseCountry({ 'home.choose-country': 'on' }, 0)).toBeNull()
    })
  })

  describe('in focus on the homepage', () => {
    const theme = (countries: number, siteCountries: number, claims = 3) =>
      inFocusRule({ countries, siteCountries, claims })

    it('shows a theme spanning two or more countries', () => {
      expect(shows('home.in-focus', auto, theme(2, 4))).toBe(true)
    })

    it('shows a theme within the one country of a one-country site', () => {
      expect(shows('home.in-focus', auto, theme(1, 1))).toBe(true)
    })

    it('leaves out a one-country theme on a site with several, and a theme with no claims', () => {
      expect(shows('home.in-focus', auto, theme(1, 3))).toBe(false)
      expect(shows('home.in-focus', auto, theme(3, 3, 0))).toBe(false)
      expect(shows('home.in-focus', auto, theme(0, 3))).toBe(false)
    })
  })

  describe('past administrations', () => {
    it('shows with at least one ended term, and is left out with none', () => {
      expect(shows('country.past-administrations', auto, pastRule(1))).toBe(true)
      expect(shows('country.past-administrations', auto, pastRule(0))).toBe(false)
    })
  })

  describe('closing summary', () => {
    it('shows once the term has ended', () => {
      expect(shows('actor.closing-summary', auto, closingRule(true, 'Served two terms.'))).toBe(
        true,
      )
    })

    it('is left out while the term runs, or with no summary', () => {
      expect(shows('actor.closing-summary', auto, closingRule(false, 'Served.'))).toBe(false)
      expect(shows('actor.closing-summary', auto, closingRule(true, '  '))).toBe(false)
      expect(shows('actor.closing-summary', auto, closingRule(true, null))).toBe(false)
    })
  })

  describe('latest analysis', () => {
    it('shows with at least one published article, and is left out with none', () => {
      expect(shows('actor.latest-analysis', auto, analysisRule(1))).toBe(true)
      expect(shows('claim.latest-analysis', auto, analysisRule(0))).toBe(false)
    })
  })

  describe("an editor's overrides", () => {
    it('force a section on when its rule would leave it out', () => {
      const forced = { 'country.who-is-delivering': 'on' } as const
      expect(shows('country.who-is-delivering', forced, peopleRule(1))).toBe(true)
      expect(
        shows('actor.closing-summary', { 'actor.closing-summary': 'on' }, closingRule(false, 'x')),
      ).toBe(true)
    })

    it('never show a section empty, even forced on', () => {
      expect(shows('country.officials', { 'country.officials': 'on' }, peopleRule(0))).toBe(false)
      expect(shows('home.partners', { 'home.partners': 'on' }, listRule(0))).toBe(false)
    })

    it('force a section off when its rule is met', () => {
      expect(
        shows(
          'country.past-administrations',
          { 'country.past-administrations': 'off' },
          pastRule(4),
        ),
      ).toBe(false)
    })

    it('touch only the section they name', () => {
      const forced = { 'country.officials': 'off' } as const
      expect(shows('country.who-is-delivering', forced, peopleRule(3))).toBe(true)
    })
  })
})
