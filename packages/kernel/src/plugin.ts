import type {
  CollectionConfig,
  Config,
  Field,
  FieldAccess,
  FieldHook,
  GlobalConfig,
  PayloadRequest,
  Plugin,
} from 'payload'
// The only import of Payload's experimental plugin API (section 4.8, rule 6).
// A change between Payload betas touches this file alone.
import { definePlugin } from 'payload'

import { KernelError } from './errors'
import type { AdapterContext, PortAdapters, PortName } from './ports'

type JobsConfig = NonNullable<Config['jobs']>
type TaskConfig = NonNullable<JobsConfig['tasks']>[number]
type WorkflowConfig = NonNullable<JobsConfig['workflows']>[number]
type Widget = NonNullable<NonNullable<Config['admin']>['dashboard']>['widgets'][number]

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

/** A route the plugin serves under `/api/plugins/{slug}/` (section 4.7). */
export interface PluginRoute {
  /** Relative to `/api/plugins/{slug}/`, for example `webhook`. */
  path: string
  methods: readonly HttpMethod[]
  description: string
}

/** What a plugin declares (section 4.3). */
export interface PluginManifest {
  slug: string
  version: string
  /** Load order. A plugin loads after every plugin it depends on. */
  order: number
  dependsOn?: readonly string[]
  /** Record types the plugin owns. */
  collections?: readonly CollectionConfig[]
  globals?: readonly GlobalConfig[]
  /**
   * Fields added to record types other plugins own. They land in a group named
   * after this plugin, must be optional, and are read-only in the admin.
   */
  extend?: readonly { collection: string; fields: readonly Field[] }[]
  /** Adapters, by port. */
  provides?: { readonly [P in PortName]?: readonly PortAdapters[P][] }
  tasks?: readonly TaskConfig[]
  workflows?: readonly WorkflowConfig[]
  routes?: readonly PluginRoute[]
  /** Fields for this plugin's group in the `settings` global. */
  settings?: readonly Field[]
  widgets?: readonly Widget[]
  /** Environment variables the plugin needs when enabled. */
  requiredEnv?: readonly string[]
  /** Runs at start-up when the plugin is enabled. Throw to stop start-up. */
  checkSettings?: (ctx: AdapterContext) => Promise<void>
}

export interface PromiseTrackerPlugin {
  readonly manifest: PluginManifest
  /** The Payload plugin, built for whether this plugin is enabled. */
  toPayloadPlugin(enabled: boolean): Plugin
}

export const SETTINGS_GLOBAL = 'settings'

/** Super-admins arrive with roles in V1-05. Until then nobody passes. */
export const isSuperAdmin = (user: PayloadRequest['user']): boolean => {
  const roles: unknown = user ? Reflect.get(user, 'roles') : undefined
  return Array.isArray(roles) && roles.includes('super-admin')
}

const deny = () => false
const superAdminOnly: FieldAccess = ({ req }) => isSuperAdmin(req.user)

/** A field may be marked required only where Payload's field type allows it. */
const isRequired = (field: Field): boolean => 'required' in field && field.required === true

/** Drops field-level hooks, recursing into fields that hold other fields. */
function withoutFieldHooks(fields: readonly Field[]): Field[] {
  return fields.map((field): Field => {
    const { hooks: _hooks, ...rest } = field as Field & { hooks?: unknown }
    const stripped = rest as Field
    if ('fields' in stripped && Array.isArray(stripped.fields)) {
      return { ...stripped, fields: withoutFieldHooks(stripped.fields) } as Field
    }
    if (stripped.type === 'tabs') {
      return {
        ...stripped,
        tabs: stripped.tabs.map((tab) => ({ ...tab, fields: withoutFieldHooks(tab.fields) })),
      }
    }
    return stripped
  })
}

/**
 * A disabled plugin's record types stay in the schema (D29) but do nothing:
 * hidden in the admin, closed to every request that checks access, and
 * without hooks.
 */
function disableCollection(collection: CollectionConfig): CollectionConfig {
  const { hooks: _hooks, ...rest } = collection
  return {
    ...rest,
    admin: { ...collection.admin, hidden: true },
    access: { read: deny, create: deny, update: deny, delete: deny },
    fields: withoutFieldHooks(collection.fields),
  }
}

function disableGlobal(global: GlobalConfig): GlobalConfig {
  const { hooks: _hooks, ...rest } = global
  return {
    ...rest,
    admin: { ...global.admin, hidden: true },
    access: { read: deny, update: deny },
    fields: withoutFieldHooks(global.fields),
  }
}

/** Logs a super-admin's change to a field a plugin owns (section 4.5, rule 3). */
const logOverride =
  (slug: string): FieldHook =>
  ({ req, value, previousValue, collection, originalDoc }) => {
    if (req.user && JSON.stringify(value) !== JSON.stringify(previousValue)) {
      req.payload.logger.warn({
        msg: `Super-admin override of a field owned by plugin "${slug}"`,
        collection: collection?.slug,
        id: originalDoc?.id,
        user: req.user.id,
        old: previousValue,
        new: value,
      })
    }
    return value
  }

/** The group that holds one plugin's fields on another plugin's record type. */
function ownedGroup(slug: string, fields: readonly Field[], enabled: boolean): Field {
  const required = fields.filter(isRequired)
  if (required.length > 0) {
    const names = required.map((f) => ('name' in f ? f.name : f.type)).join(', ')
    throw new KernelError(
      `Plugin "${slug}" adds required fields (${names}). Fields a plugin adds must be optional.`,
    )
  }
  return {
    name: slug,
    type: 'group',
    fields: enabled ? [...fields] : withoutFieldHooks(fields),
    access: { update: superAdminOnly },
    admin: enabled ? { readOnly: true } : { readOnly: true, condition: () => false },
    hooks: enabled ? { beforeChange: [logOverride(slug)] } : {},
  }
}

function extendCollections(
  collections: readonly CollectionConfig[],
  manifest: PluginManifest,
  enabled: boolean,
): CollectionConfig[] {
  const result = [...collections]
  for (const { collection: target, fields } of manifest.extend ?? []) {
    const index = result.findIndex((c) => c.slug === target)
    const existing = result[index]
    if (!existing) {
      throw new KernelError(
        `Plugin "${manifest.slug}" extends "${target}", which no earlier plugin defines. ` +
          'Load the plugin that owns it first.',
      )
    }
    if (existing.fields.some((f) => 'name' in f && f.name === manifest.slug)) {
      throw new KernelError(
        `"${target}" already has a field named "${manifest.slug}", which plugin "${manifest.slug}" needs for its group.`,
      )
    }
    result[index] = {
      ...existing,
      fields: [...existing.fields, ownedGroup(manifest.slug, fields, enabled)],
    }
  }
  return result
}

/**
 * A disabled plugin's tasks stay registered, because Payload builds the jobs
 * table from task names, but they refuse to run and have no schedule.
 */
function disableTask(slug: string, task: TaskConfig): TaskConfig {
  const { schedule: _schedule, ...rest } = task
  return {
    ...rest,
    handler: () => {
      throw new KernelError(`Task "${task.slug}" belongs to plugin "${slug}", which is disabled.`)
    },
  }
}

function disableWorkflow(slug: string, workflow: WorkflowConfig): WorkflowConfig {
  const { schedule: _schedule, ...rest } = workflow
  return {
    ...rest,
    handler: () => {
      throw new KernelError(
        `Workflow "${workflow.slug}" belongs to plugin "${slug}", which is disabled.`,
      )
    },
  }
}

function addSettings(globals: readonly GlobalConfig[], manifest: PluginManifest, enabled: boolean) {
  if (!manifest.settings?.length) return [...globals]
  const group: Field = {
    name: manifest.slug,
    type: 'group',
    fields: [...manifest.settings],
    admin: enabled ? {} : { condition: () => false },
  }
  const existing = globals.find((g) => g.slug === SETTINGS_GLOBAL)
  if (!existing) {
    return [
      ...globals,
      {
        slug: SETTINGS_GLOBAL,
        // Settings hold credentials, so only super-admins can read them (section 7.10).
        access: {
          read: ({ req }) => isSuperAdmin(req.user),
          update: ({ req }) => isSuperAdmin(req.user),
        },
        fields: [group],
      } satisfies GlobalConfig,
    ]
  }
  return globals.map((g) =>
    g.slug === SETTINGS_GLOBAL ? { ...g, fields: [...g.fields, group] } : g,
  )
}

/** Applies a manifest to the Payload config. Exported for tests. */
export function applyManifest(config: Config, manifest: PluginManifest, enabled: boolean): Config {
  const { slug } = manifest
  const ownCollections = (manifest.collections ?? []).map((c) =>
    enabled ? c : disableCollection(c),
  )
  const ownGlobals = (manifest.globals ?? []).map((g) => (enabled ? g : disableGlobal(g)))
  const tasks = (manifest.tasks ?? []).map((t) => (enabled ? t : disableTask(slug, t)))
  const workflows = (manifest.workflows ?? []).map((w) => (enabled ? w : disableWorkflow(slug, w)))

  const next: Config = {
    ...config,
    collections: extendCollections(
      [...(config.collections ?? []), ...ownCollections],
      manifest,
      enabled,
    ),
    globals: addSettings([...(config.globals ?? []), ...ownGlobals], manifest, enabled),
  }
  if (tasks.length || workflows.length) {
    next.jobs = {
      ...config.jobs,
      tasks: [...(config.jobs?.tasks ?? []), ...tasks],
      workflows: [...(config.jobs?.workflows ?? []), ...workflows],
    }
  }
  if (enabled && manifest.widgets?.length) {
    next.admin = {
      ...config.admin,
      dashboard: {
        ...config.admin?.dashboard,
        widgets: [...(config.admin?.dashboard?.widgets ?? []), ...manifest.widgets],
      },
    }
  }
  return next
}

/**
 * Defines a PromiseTracker plugin: Payload's `definePlugin`, plus the manifest
 * in section 4.3. The kernel decides whether it is enabled.
 */
export function definePromiseTrackerPlugin(manifest: PluginManifest): PromiseTrackerPlugin {
  if (!/^[a-z][a-z0-9-]*$/.test(manifest.slug)) {
    throw new KernelError(
      `Plugin slug "${manifest.slug}" must be lower case letters, digits and hyphens.`,
    )
  }
  return Object.freeze({
    manifest,
    toPayloadPlugin: (enabled: boolean) =>
      definePlugin({
        slug: `promisetracker-${manifest.slug}`,
        order: manifest.order,
        plugin: ({ config }) => applyManifest(config, manifest, enabled),
      })(),
  })
}
