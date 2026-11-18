import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import type { EmailAdapter } from 'payload'

type Env = Readonly<Record<string, string | undefined>>

export type SmtpSettings = {
  host: string
  port: number
  user?: string
  password?: string
  fromAddress: string
  fromName: string
}

/**
 * Where email goes. No provider is chosen yet (D40), so outside production it
 * defaults to Mailpit from `pnpm services`, which keeps every message for
 * reading and testing. Production sends nothing until SMTP_HOST is set.
 */
export function smtpSettings(env: Env = process.env): SmtpSettings | null {
  const production = env.NODE_ENV === 'production'
  const host = env.SMTP_HOST?.trim() || (production ? '' : 'localhost')
  if (!host) return null
  const port = Number(env.SMTP_PORT?.trim() || (production ? '587' : env.PT_SMTP_PORT || '1025'))
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`SMTP_PORT must be a port number, not "${env.SMTP_PORT ?? ''}".`)
  }
  const user = env.SMTP_USER?.trim()
  const password = env.SMTP_PASSWORD
  return {
    host,
    port,
    ...(user ? { user } : {}),
    ...(user && password ? { password } : {}),
    fromAddress: env.PT_EMAIL_FROM?.trim() || 'noreply@promisetracker.local',
    fromName: env.PT_EMAIL_FROM_NAME?.trim() || 'PromiseTracker',
  }
}

/**
 * Payload's email adapter, or none. With no settings the nodemailer adapter
 * would create an Ethereal test account over the network, so it is only built
 * when there is somewhere to send.
 */
export function emailAdapter(env: Env = process.env): Promise<EmailAdapter> | undefined {
  const smtp = smtpSettings(env)
  if (!smtp) return undefined
  return nodemailerAdapter({
    defaultFromAddress: smtp.fromAddress,
    defaultFromName: smtp.fromName,
    // Payload would otherwise log an error at start-up whenever Mailpit or the
    // provider is down. A failed send still fails.
    skipVerify: true,
    transportOptions: {
      host: smtp.host,
      port: smtp.port,
      // 465 is the implicit TLS port. Others upgrade with STARTTLS when offered.
      secure: smtp.port === 465,
      ...(smtp.user ? { auth: { user: smtp.user, pass: smtp.password ?? '' } } : {}),
    },
  })
}
