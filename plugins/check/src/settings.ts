import type { AdapterContext, Verdict } from '@promisetracker/kernel'
import { ConfigurationError, createLog } from '@promisetracker/kernel'
import { encryptedSecretField } from '@promisetracker/plugin-core'
import type { Field } from 'payload'
import type { CallOptions, CheckCredentials } from './client'
import { workspaceStatuses } from './client'

export const VERDICTS = [
  'verified',
  'false',
  'misleading',
  'unverified',
] as const satisfies Verdict[]

/** The default workspace's statuses and their verdicts (section 5.2). */
export const DEFAULT_STATUS_MAP = [
  { status: 'verified', verdict: 'verified' },
  { status: 'false', verdict: 'false' },
  { status: 'undetermined', verdict: 'unverified' },
  { status: 'in_progress', verdict: 'unverified' },
  { status: 'not_applicable', verdict: 'unverified' },
] as const

/** The plugin's part of the settings global. Only super-admins read or change it. */
export const settingsFields: Field[] = [
  {
    name: 'workspace',
    type: 'text',
    admin: {
      description:
        "The workspace's short name, from its address in Check: checkmedia.org/{name}/all-items.",
    },
  },
  encryptedSecretField({
    name: 'apiKey',
    label: 'API key',
    admin: {
      description: 'A key from the workspace’s settings, under API keys. Stored encrypted.',
    },
  }),
  encryptedSecretField({
    name: 'webhookSecret',
    label: 'Webhook secret',
    admin: {
      description:
        'Check sends this in the Authorization header of every webhook. Stored encrypted.',
    },
  }),
  {
    name: 'statuses',
    label: 'Statuses and verdicts',
    type: 'array',
    defaultValue: DEFAULT_STATUS_MAP.map((row) => ({ ...row })),
    admin: {
      description:
        'Statuses are managed in Check. Give each of the workspace’s statuses a verdict. ' +
        'PromiseTracker will not start while one has none.',
    },
    fields: [
      {
        type: 'row',
        fields: [
          { name: 'status', type: 'text', admin: { width: '50%' } },
          {
            name: 'verdict',
            type: 'select',
            options: VERDICTS.map((value) => ({ label: value, value })),
            admin: { width: '50%' },
          },
        ],
      },
    ],
  },
]

export type CheckSettings = {
  credentials: CheckCredentials | null
  webhookSecret: string | null
  statuses: ReadonlyMap<string, Verdict>
}

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null

/** The settings an adapter method receives, read into their types. */
export function readCheckSettings(settings: Readonly<Record<string, unknown>>): CheckSettings {
  const workspace = text(settings.workspace)
  const apiKey = text(settings.apiKey)
  const rows = Array.isArray(settings.statuses) ? settings.statuses : []
  const statuses = new Map<string, Verdict>()
  for (const row of rows) {
    const status = text(row && typeof row === 'object' ? Reflect.get(row, 'status') : null)
    const verdict: unknown = row && typeof row === 'object' ? Reflect.get(row, 'verdict') : null
    if (status && (VERDICTS as readonly unknown[]).includes(verdict)) {
      statuses.set(status, verdict as Verdict)
    }
  }
  return {
    credentials: workspace && apiKey ? { workspace, apiKey } : null,
    webhookSecret: text(settings.webhookSecret),
    statuses,
  }
}

/**
 * At start-up, every status the workspace defines must have a verdict (D42).
 * An unmapped one stops start-up and is named. Settings not filled in yet, or
 * Check out of reach, only warn: the first lets a super-admin fill them in,
 * and the second must not stop a deploy, which the poll recovers from.
 */
export async function checkStatusMapping(
  ctx: AdapterContext,
  options: CallOptions = {},
): Promise<void> {
  const log = createLog(ctx.logger, 'check')
  const settings = readCheckSettings(ctx.settings)
  if (!settings.credentials) {
    log.warn('The Check plugin has no workspace or API key yet. Fill them in under Settings.')
    return
  }
  let statuses: { id: string; label: string }[]
  try {
    statuses = await workspaceStatuses(settings.credentials, { signal: ctx.signal, ...options })
  } catch (error) {
    log.warn('Could not read the Check workspace’s statuses at start-up', { error })
    return
  }
  const unmapped = statuses.filter((status) => !settings.statuses.has(status.id))
  if (unmapped.length > 0) {
    // A custom status's id is a number, so its label says which one it is.
    const named = unmapped.map((s) => (s.label === s.id ? `"${s.id}"` : `"${s.label}" (${s.id})`))
    throw new ConfigurationError(
      `Check status ${named.join(', ')} has no verdict. ` +
        'Give it one under Settings, Check, Statuses and verdicts, by its id.',
    )
  }
}
