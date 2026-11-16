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

test('GraphQL is switched off', async ({ request }) => {
  const res = await request.post('/api/graphql', { data: { query: '{ __typename }' } })
  // There is no GraphQL route, so the request lands on the REST routes, which refuse guests.
  expect(res.status()).toBe(401)
  expect(await res.json()).not.toHaveProperty('data')
})

test.describe("Payload's REST routes are closed to guests", () => {
  const refused = 'Sign in to use this API.'

  test('a guest reads no record through them', async ({ request }) => {
    for (const path of ['/api/users', '/api/media', '/api/globals/site', '/api/access']) {
      const res = await request.get(path)
      expect(res.status(), path).toBe(401)
      expect((await res.json()).errors[0].message).toBe(refused)
    }
  })

  test('a guest cannot register, as the first user or any other', async ({ request }) => {
    const data = { email: 'intruder@example.org', password: 'a-long-password' }
    for (const path of ['/api/users/first-register', '/api/users']) {
      const res = await request.post(path, { data })
      expect(res.status(), path).toBe(401)
    }
  })

  test('a guest can still reach what signing in needs', async ({ request }) => {
    const me = await request.get('/api/users/me')
    expect(me.ok()).toBe(true)
    expect((await me.json()).user).toBeNull()

    // A wrong password is refused by Payload itself, not by the gate.
    const login = await request.post('/api/users/login', {
      data: { email: 'nobody@example.org', password: 'wrong-password' },
    })
    expect(login.status()).toBe(401)
    expect(JSON.stringify(await login.json())).not.toContain(refused)
  })

  test('the public API still answers guests', async ({ request }) => {
    expect((await request.get('/api/v1/site')).ok()).toBe(true)
  })
})
