import './setup'

import { prepareTestDatabase } from '../database'

/** Gives the integration tests a fresh database, migrated to the committed migrations. */
export default async function setup(): Promise<void> {
  await prepareTestDatabase(process.env.DATABASE_URL ?? '')
}
