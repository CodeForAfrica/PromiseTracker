import '../load-env'

import { switchToTestDatabase } from '../database'

// Runs in every test process, so no integration test can reach the database
// `pnpm dev` uses, or send a real email.
switchToTestDatabase('int')
process.env.SMTP_HOST = 'localhost'
process.env.SMTP_PORT = process.env.PT_SMTP_PORT || '1025'
Reflect.deleteProperty(process.env, 'SMTP_USER')
Reflect.deleteProperty(process.env, 'SMTP_PASSWORD')
