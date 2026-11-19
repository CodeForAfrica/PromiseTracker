import { readFileSync } from 'node:fs'
import path from 'node:path'

import { expect, test } from '@playwright/test'

import type { Seed } from './seed'

const seed = (): Seed =>
  JSON.parse(readFileSync(path.resolve(import.meta.dirname, '.seed.json'), 'utf8')) as Seed

/** The admin warns while a rating's text fails WCAG AA on its colour (section 7.4). */
test('the admin warns when a rating’s colours fail WCAG AA', async ({ page }) => {
  const { admin } = seed()
  await page.goto('/admin/login')
  await page.locator('#field-email').fill(admin.email)
  await page.locator('#field-password').fill(admin.password)
  await page.getByRole('button', { name: /log ?in/i }).click()
  await expect(page).not.toHaveURL(/login/)

  await page.goto('/admin/collections/rating-scales')
  await page.getByRole('link', { name: 'Delivery' }).first().click()
  await page.getByRole('button', { name: 'Completed', exact: false }).first().click()

  await expect(page.getByText(/meets WCAG AA/).first()).toBeVisible()
  const text = page.locator('#field-ratings__0__textColour')
  await text.fill('#7fc4e8')
  await expect(page.getByRole('alert').filter({ hasText: /fails WCAG AA/ })).toBeVisible()
})
