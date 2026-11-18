import { readFileSync } from 'node:fs'
import path from 'node:path'

import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

import type { Seed } from './seed'

/**
 * The public site's first pages (#644). The countries come from
 * tests/e2e/seed.ts: one published in English and French, one in English only.
 * The browser tests run with PT_LOCALES=en,fr,ar.
 */
const seed = (): Seed =>
  JSON.parse(readFileSync(path.resolve(import.meta.dirname, '.seed.json'), 'utf8')) as Seed

async function expectAccessible(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual([])
}

test('/ sends a French reader to French, and anyone else to English', async ({ request }) => {
  const visit = (language: string) =>
    request.get('/', { headers: { 'Accept-Language': language }, maxRedirects: 0 })
  const french = await visit('fr-SN,fr;q=0.9,en;q=0.8')
  expect(french.status()).toBe(307)
  expect(french.headers().location).toBe('/fr')
  expect((await visit('de-DE,de;q=0.9')).headers().location).toBe('/en')
})

test('the home page explains the site and lets the reader choose a country', async ({ page }) => {
  await page.goto('/en')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('A record of what')
  const picker = page.getByRole('region', { name: 'Choose a country' })
  await expect(picker.getByRole('link', { name: seed().full.en })).toBeVisible()
  await expectAccessible(page)
})

test('the home page in French lists only countries published in French', async ({ page }) => {
  await page.goto('/fr')
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
  const { full, englishOnly } = seed()
  await expect(page.getByRole('link', { name: full.fr }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: englishOnly.en })).toHaveCount(0)
})

test('a country page shows the country, and the language switch keeps the page', async ({
  page,
}) => {
  const { full } = seed()
  await page.goto(`/en/${full.code}`)
  await expect(page.getByRole('heading', { level: 1, name: full.en })).toBeVisible()
  await expect(page.getByText(`About ${full.en}.`)).toBeVisible()
  await expectAccessible(page)

  await page.getByRole('link', { name: 'fr', exact: true }).first().click()
  await expect(page).toHaveURL(new RegExp(`/fr/${full.code}$`))
  await expect(page.getByRole('heading', { level: 1, name: full.fr })).toBeVisible()
})

test('a country not in French says so, and links to the English page', async ({ page }) => {
  const { englishOnly } = seed()
  const res = await page.goto(`/fr/${englishOnly.code}`)
  expect(res?.ok()).toBe(true)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('pas encore disponible')
  // No English text from the record appears on the French page (D30).
  await expect(page.getByText(`About ${englishOnly.en}.`)).toHaveCount(0)
  await page.getByRole('link', { name: 'English' }).click()
  await expect(page).toHaveURL(new RegExp(`/en/${englishOnly.code}$`))
  await expectAccessible(page)
})

test('an unknown country, page or language is not found', async ({ page }) => {
  // Portuguese is registered but not switched on in the browser tests, so its pages do not exist.
  const { full } = seed()
  for (const path of [
    '/en/zz',
    `/en/${full.code}/nothing-here`,
    '/de',
    '/pt',
    `/pt/${full.code}`,
  ]) {
    const res = await page.goto(path)
    expect(res?.status(), path).toBe(404)
  }
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('This page is not on the record')
})

test('a right-to-left language lays out without breaking', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/ar')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
  // The logo starts the line, which is on the right in Arabic, with the language switch after it.
  const logo = await page.getByRole('link', { name: 'PromiseTracker home' }).boundingBox()
  const languages = await page.getByRole('navigation', { name: 'Language' }).boundingBox()
  expect(logo?.x ?? 0).toBeGreaterThan(languages?.x ?? Number.POSITIVE_INFINITY)
  await expectAccessible(page)
})
