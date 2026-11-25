import { createLocalTransport, getPayload, respondForm, respondV1 } from '@promisetracker/cms'
import type { Transport } from '@promisetracker/sdk'
import { createHttpTransport } from '@promisetracker/sdk'

/**
 * The transport the SDK's integration tests use. The `int` project uses the
 * local one, which calls the handlers in this process. The `int-http` project
 * runs the same files over HTTP, through the route's own code with real
 * requests and responses (vitest.config.ts). Both must pass, so switching the
 * site's transport stays a one-line change.
 */
export function testTransport(): Transport {
  if (process.env.PT_SDK_TRANSPORT !== 'http') return createLocalTransport()
  return createHttpTransport('http://promisetracker.test', {}, async (input, init) => {
    const request = new Request(input, init)
    const path = new URL(request.url).pathname.replace(/^\/api\/v1/, '')
    return request.method === 'POST'
      ? respondForm(request, path, getPayload)
      : respondV1(request, path, getPayload)
  })
}

export const transportName = () => (process.env.PT_SDK_TRANSPORT === 'http' ? 'http' : 'local')
