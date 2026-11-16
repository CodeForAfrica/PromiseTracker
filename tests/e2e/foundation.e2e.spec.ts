import { expect, test } from '@playwright/test'

test('the home page shows the site name stored in Payload', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('PromiseTracker')
})

test('the health check reports the database and file storage', async ({ request }) => {
  const res = await request.get('/api/health')
  expect(res.ok()).toBe(true)
  const body = await res.json()
  expect(body.status).toBe('healthy')
  expect(body.services.database.healthy).toBe(true)
  expect(body.services.storage.healthy).toBe(true)
})

test('the API serves the same data the page shows', async ({ request }) => {
  const res = await request.get('/api/v1/site')
  expect(res.ok()).toBe(true)
  expect(await res.json()).toMatchObject({ name: 'PromiseTracker' })
  expect((await request.get('/api/v1/unknown')).status()).toBe(404)
})

test('the admin is mounted at /admin', async ({ page }) => {
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/admin/)
  await expect(page.locator('form')).toBeVisible()
})
