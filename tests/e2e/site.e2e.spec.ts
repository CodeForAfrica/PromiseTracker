import { readFileSync } from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'

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
  // Next.js streams the title after the page, so wait for it before checking.
  await expect(page).toHaveTitle(/\S/)
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

test('a county has its own page, with the seats that answer for it', async ({ page }) => {
  const { full } = seed()
  await page.goto(`/en/${full.code}/nairobi-county`)
  await expect(page.getByRole('heading', { level: 1, name: 'Nairobi County' })).toBeVisible()
  const breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' })
  await expect(breadcrumb.getByRole('link', { name: full.en })).toBeVisible()
  const seats = page.getByRole('region', { name: 'Who answers for this place' })
  for (const office of ['Governor', 'Senator', 'Woman Representative']) {
    await expect(seats.getByText(office, { exact: true })).toBeVisible()
  }
  await expectAccessible(page)
})

test('a constituency with one seat lists it without a page of its own', async ({ page }) => {
  const { full } = seed()
  await page.goto(`/en/${full.code}/kibra`)
  await expect(page.getByRole('heading', { level: 1, name: 'Kibra' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Seats in Kibra' })).toContainText(
    'Member of Parliament',
  )
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toHaveCount(0)
  await expectAccessible(page)
})

test('the whole-country area and unknown areas are not pages', async ({ page }) => {
  const { full } = seed()
  for (const area of ['kenya', 'atlantis']) {
    const res = await page.goto(`/en/${full.code}/${area}`)
    expect(res?.status(), area).toBe(404)
  }
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

test('a seat leads to its holder today, and a former holder keeps an archived page', async ({
  page,
}) => {
  const { full } = seed()
  // The governor's term ended in 2022, and the seat passed to a new holder.
  await page.goto(`/en/${full.code}/nairobi-county/governor`)
  await expect(page).toHaveURL(new RegExp(`/en/${full.code}/e/achieng-wekesa$`))
  await expect(page.getByRole('heading', { level: 1, name: 'Achieng Wekesa' })).toBeVisible()
  await expect(page.getByText('Governor, Nairobi County').first()).toBeVisible()
  await expectAccessible(page)

  await page.goto(`/en/${full.code}/e/baraka-njoroge`)
  await expect(page.getByText('Former office holder')).toBeVisible()
  const closing = page.getByRole('region', { name: 'How the term closed' })
  await expect(closing).toContainText('Two of five housing pledges were met.')
  await closing.getByRole('link', { name: 'Achieng Wekesa' }).click()
  await expect(page).toHaveURL(/\/e\/achieng-wekesa$/)
})

test('an area with one seat leads to its holder, and a national seat to its own', async ({
  page,
}) => {
  const { full } = seed()
  await page.goto(`/en/${full.code}/westlands`)
  await expect(page).toHaveURL(/\/e\/juma-hassan$/)
  await page.goto(`/en/${full.code}/president`)
  await expect(page).toHaveURL(/\/e\/amani-otieno$/)
})

test('a county page names who holds each seat', async ({ page }) => {
  const { full } = seed()
  await page.goto(`/en/${full.code}/nairobi-county`)
  const seats = page.getByRole('region', { name: 'Who answers for this place' })
  for (const name of ['Achieng Wekesa', 'Halima Yusuf', 'Wanjiru Kamau']) {
    await expect(seats.getByRole('link', { name: new RegExp(name) })).toBeVisible()
  }
})

test('the country page shows the officials, and those who held office before', async ({ page }) => {
  const { full } = seed()
  await page.goto(`/en/${full.code}`)
  await expect(page.getByRole('region', { name: 'Who is delivering' })).toContainText(
    'Amani Otieno',
  )
  await expect(page.getByRole('region', { name: 'Officials' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Past administrations' })).toContainText(
    'Baraka Njoroge',
  )
  await expectAccessible(page)
  // The English-only country has no office holders, so its page has none of these sections.
  await page.goto(`/en/${seed().englishOnly.code}`)
  await expect(page.getByRole('region', { name: 'Officials' })).toHaveCount(0)
})

test('the officials list filters by office, and keeps the filter in the address', async ({
  page,
}) => {
  const { full } = seed()
  await page.goto(`/en/${full.code}/officials`)
  await expect(page.getByRole('heading', { level: 1, name: 'Officials' })).toBeVisible()
  await expectAccessible(page)
  await page.getByLabel('Office', { exact: true }).selectOption('governor')
  await page.getByRole('button', { name: 'Show' }).click()
  await expect(page).toHaveURL(/office=governor/)
  const list = page.getByRole('main').getByRole('list').last()
  await expect(list.getByRole('link')).toHaveCount(2)
  await expect(list).toContainText('Achieng Wekesa')
  await expect(list).toContainText('Zawadi Mutua')
})

test('seat addresses answer with a real redirect, not a page', async ({ request }) => {
  const { full } = seed()
  const visit = (path: string) => request.get(path, { maxRedirects: 0 })
  const seat = await visit(`/en/${full.code}/westlands`)
  expect(seat.status()).toBe(307)
  expect(seat.headers().location).toBe(`/en/${full.code}/e/juma-hassan`)
  const national = await visit(`/en/${full.code}/president`)
  expect(national.status()).toBe(307)
})

test('a claim page shows the claim, who made it, when it is due and its rating', async ({
  page,
}) => {
  const { full } = seed()
  await page.goto(`/en/${full.code}/p/kibra-housing`)
  await expect(
    page.getByRole('heading', { level: 1, name: 'Build 5000 homes in Kibra' }),
  ).toBeVisible()
  await expect(page.getByText('Unstarted', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('We will build five thousand homes in Kibra.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Achieng Wekesa' })).toBeVisible()
  await expect(page.getByText('2027', { exact: true })).toBeVisible()
  await expectAccessible(page)
})

test('an actor page lists their claims, the key claim and their record so far', async ({
  page,
}) => {
  const { full } = seed()
  await page.goto(`/en/${full.code}/e/achieng-wekesa`)
  await expect(page.getByRole('region', { name: 'Key claim' })).toContainText(
    'Her flagship housing pledge.',
  )
  await expect(page.getByRole('region', { name: 'Record so far' })).toContainText('2 of 2')
  const claims = page.getByRole('region', { name: 'Claims' })
  await expect(claims.getByRole('link')).toHaveCount(2)
  await expectAccessible(page)

  await claims.getByLabel('Topic').selectOption('housing')
  await claims.getByRole('button', { name: 'Show' }).click()
  await expect(page).toHaveURL(/topic=housing/)
  await expect(page.getByRole('region', { name: 'Claims' }).getByRole('link')).toHaveCount(1)
})

test('a topic page shows its claims, with figures by country', async ({ page }) => {
  const { full } = seed()
  await page.goto('/en/topics/health')
  await expect(page.getByRole('heading', { level: 1, name: 'Health' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'By country' })).toContainText(full.en)
  // Other countries may have claims on Health too, so only this country's are checked.
  await expect(page.getByRole('region', { name: 'Claims on this topic' })).toContainText(
    'Clean water for every ward',
  )
  await expectAccessible(page)
})

test('a claim page ships under 150 KB of JavaScript, compressed (section 17)', async ({ page }) => {
  // Only a production build is measured: a development server ships its tools too.
  test.skip(!process.env.PT_E2E_URL, 'Needs a production build, named in PT_E2E_URL.')
  const { full } = seed()
  const sizes: Promise<number>[] = []
  page.on('response', (response) => {
    if (response.request().resourceType() === 'script') {
      sizes.push(response.body().then((body) => gzipSync(body).length))
    }
  })
  await page.goto(`/en/${full.code}/p/kibra-housing`, { waitUntil: 'networkidle' })
  const total = (await Promise.all(sizes)).reduce((sum, n) => sum + n, 0)
  expect(total).toBeLessThan(150 * 1024)
})

test('a search for a place lists everyone who represents it, from the president down', async ({
  page,
}) => {
  await page.goto('/en/search?q=Nairobi')
  await expect(page.getByRole('heading', { level: 1, name: 'Nairobi' })).toBeVisible()
  const place = page.getByRole('region', { name: 'Nairobi County' })
  const names = place.getByRole('link').filter({ hasNotText: 'Open the page' })
  await expect(names).toContainText([
    'Amani Otieno',
    'Achieng Wekesa',
    'Halima Yusuf',
    'Wanjiru Kamau',
    'Juma Hassan',
  ])
  // A former governor and a member whose term has not started represent no one today.
  await expect(place).not.toContainText('Baraka Njoroge')
  await expect(place).not.toContainText('Kito Barasa')
  await expectAccessible(page)
})

test('the header leads to search, and the address keeps the search', async ({ page }) => {
  await page.goto('/en')
  await page.getByRole('banner').getByRole('link', { name: 'Search' }).click()
  await expect(page).toHaveURL(/\/en\/search$/)
  await page
    .getByRole('searchbox', { name: 'Search for a place, a person or a claim' })
    .fill('Wekesa')
  await page.getByRole('button', { name: 'Search' }).click()
  await expect(page).toHaveURL(/\/en\/search\?q=Wekesa$/)
  await expect(page.getByRole('region', { name: 'People' })).toContainText('Achieng Wekesa')
  await page.goto('/en/search?q=zzqxv')
  await expect(
    page.getByText('Nothing on the record matches “zzqxv”.', { exact: false }),
  ).toBeVisible()
  await expectAccessible(page)
})
