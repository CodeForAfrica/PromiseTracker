import { getHealth, getPayload } from '@promisetracker/cms'
import { createSdk } from '@promisetracker/sdk'
import { afterAll, describe, expect, it } from 'vitest'
import { testTransport } from './transport'

/**
 * The V1-03 tracer: a value stored in Postgres, read by Payload, passed
 * through the SDK's local transport and checked against the contract.
 */
describe('foundation', () => {
  const sdk = createSdk(testTransport())

  afterAll(async () => {
    const payload = await getPayload()
    await payload.updateGlobal({
      slug: 'site',
      locale: 'en',
      data: { description: null },
      overrideAccess: true,
    })
    // Close the database pool so the test run can exit.
    await payload.destroy()
  })

  it('reads a value stored in Postgres through the SDK, anonymously, with access rules on', async () => {
    const payload = await getPayload()
    const description = `Tracked on ${new Date().toISOString()}`
    // Tests write as the system, without a signed-in user.
    await payload.updateGlobal({
      slug: 'site',
      locale: 'en',
      data: { description },
      overrideAccess: true,
    })

    await expect(sdk.getSiteInfo('en')).resolves.toMatchObject({
      name: 'PromiseTracker',
      locale: 'en',
      description,
    })
  })

  it('reports the database and file storage as healthy', async () => {
    const health = await getHealth()
    // A plugin's service, such as Tika, can be down without this: that is degraded, not unhealthy.
    expect(health.status).not.toBe('unhealthy')
    expect(health.services.database?.healthy).toBe(true)
    expect(health.services.storage?.healthy).toBe(true)
    expect(health.plugins.enabled).toEqual(expect.arrayContaining(['core', 'site']))
    expect(health.ports.verification).toEqual(['native'])
    expect(health.ports.search).toEqual(['payload-search'])
  })

  it('uses UUID ids', async () => {
    const payload = await getPayload()
    const user = await payload.create({
      collection: 'users',
      data: {
        email: `test-${crypto.randomUUID()}@example.org`,
        password: crypto.randomUUID(),
        roles: ['viewer'],
      },
      overrideAccess: true,
    })
    expect(user.id).toMatch(/^[0-9a-f-]{36}$/)
    await payload.delete({ collection: 'users', id: user.id, overrideAccess: true })
  })
})
