// Run by Playwright's web server command before `next dev` starts. Playwright
// starts the web server before its global set-up, so the database cannot be
// prepared there.
import '../load-env'

import { prepareTestDatabase, switchToTestDatabase } from '../database'

await prepareTestDatabase(switchToTestDatabase('e2e'))
