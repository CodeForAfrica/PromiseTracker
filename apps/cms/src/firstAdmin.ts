import type { Payload } from 'payload'

type Env = Readonly<Record<string, string | undefined>>

const MIN_PASSWORD_LENGTH = 12

/**
 * Creates the first super-admin from PT_ADMIN_EMAIL and PT_ADMIN_PASSWORD while
 * no user exists (D48). Nobody can register through the admin, so this is the
 * only way in on a new installation. Once a user exists it does nothing.
 */
export async function ensureFirstAdmin(payload: Payload, env: Env = process.env): Promise<void> {
  // This runs at start-up, before anyone can sign in, so there is no user to act as.
  const { totalDocs } = await payload.count({ collection: 'users', overrideAccess: true })
  if (totalDocs > 0) return

  const email = env.PT_ADMIN_EMAIL?.trim()
  const password = env.PT_ADMIN_PASSWORD
  if (!email || !password) {
    payload.logger.warn(
      'No users exist, and nobody can register. Set PT_ADMIN_EMAIL and PT_ADMIN_PASSWORD and restart to create the first super-admin.',
    )
    return
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`PT_ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters.`)
  }

  try {
    await payload.create({
      collection: 'users',
      data: { email, password, name: 'Administrator', roles: ['super-admin'] },
      // As above: no user exists yet. Roles can only be set by a super-admin otherwise.
      overrideAccess: true,
    })
  } catch (error) {
    // The web process and the worker start together. If the other one created
    // the user first, there is nothing left to do.
    const again = await payload.count({ collection: 'users', overrideAccess: true })
    if (again.totalDocs > 0) return
    throw error
  }
  // The address is left out. Logs never hold email addresses (section 13.7).
  payload.logger.info('Created the first super-admin from PT_ADMIN_EMAIL.')
}
