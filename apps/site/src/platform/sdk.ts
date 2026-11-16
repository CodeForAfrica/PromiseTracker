/**
 * The seam between the site and the platform.
 *
 * At launch the site and the platform run in one deployment, so the SDK uses
 * the local transport, which calls the platform in this process. To run the
 * site on its own, change the one line below to
 * `createHttpTransport(process.env.PT_API_URL!)` and delete the `(payload)`
 * route group.
 *
 * This folder and `src/app/(payload)` are the only places in the site allowed
 * to import the platform. The lint rule in `eslint.config.mjs` enforces it.
 */
import 'server-only'

import { createLocalTransport } from '@promisetracker/cms'
import { createSdk } from '@promisetracker/sdk'

export const sdk = createSdk(createLocalTransport())
