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

import { ConfigurationError } from './errors'
import type { AdapterContext, PortAdapters, PortName } from './ports'
import { forgetSettings, SETTINGS_GLOBAL } from './settings'

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
  /**
   * Fields on another plugin's record type that this plugin writes while it is
   * enabled, as dotted paths such as `verification.verdict` (section 4.5).
   * They become read-only in the admin to everyone but a super-admin. The
   * fields stay where they are, so disabling the plugin hands them back.
   */
  takesOver?: readonly { collection: string; fields: readonly string[] }[]
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

/** Super-admins arrive with roles in V1-05. Until then nobody passes. */
export const isSuperAdmin = (user: PayloadRequest['user']): boolean => {
  const roles: unknown = user ? Reflect.get(user, 'roles') : undefined
  return Array.isArray(roles) && roles.includes('super-admin')
}

const deny = () => false
const superAdminOnly: FieldAccess = ({ req }) => isSuperAdmin(req.user)

/** Fields nested inside a field: in groups, rows, arrays, collapsibles, tabs and blocks. */
function childFields(field: Field): Field[] {
  if (field.type === 'tabs') return field.tabs.flatMap((tab) => tab.fields)
  if (field.type === 'blocks') {
    return (field.blocks ?? []).flatMap((block) => (typeof block === 'string' ? [] : block.fields))
  }
  return 'fields' in field && Array.isArray(field.fields) ? field.fields : []
}

/**
 * Names of fields that make a record invalid when the plugin is removed:
 * required fields, and arrays with a minimum number of rows. Checked at every
 * depth (section 4.5, rule 1).
 */
function nonOptionalFields(fields: readonly Field[]): string[] {
  return fields.flatMap((field) => {
    const name = 'name' in field ? field.name : field.type
    const required = 'required' in field && field.required === true
    const minRows = 'minRows' in field && typeof field.minRows === 'number' && field.minRows > 0
    const own = required || minRows ? [name] : []
    return [...own, ...nonOptionalFields(childFields(field))]
  })
}

/**
 * Drops field-level hooks at every depth. Blocks referenced by slug
 * (`blockReferences`) live in the config's shared blocks, which belong to no
 * one plugin, so they are left alone.
 */
function withoutFieldHooks(fields: readonly Field[]): Field[] {
  return fields.map((field): Field => {
    const { hooks: _hooks, ...rest } = field as Field & { hooks?: unknown }
    const stripped = rest as Field
    if (stripped.type === 'tabs') {
      return {
        ...stripped,
        tabs: stripped.tabs.map((tab) => ({ ...tab, fields: withoutFieldHooks(tab.fields) })),
      }
    }
    if (stripped.type === 'blocks') {
      return {
        ...stripped,
        blocks: (stripped.blocks ?? []).map((block) => {
          // A block named by slug is a shared block (see above).
          if (typeof block === 'string') return block
          return { ...block, fields: withoutFieldHooks(block.fields) }
        }),
      }
    }
    if ('fields' in stripped && Array.isArray(stripped.fields)) {
      return { ...stripped, fields: withoutFieldHooks(stripped.fields) } as Field
    }
    return stripped
  })
}

/**
 * A disabled plugin's record types stay in the schema (D29) but do nothing:
 * hidden in the admin, closed to every request that checks access, and
 * without hooks or custom endpoints, which do not check access.
 */
function disableCollection(slug: string, collection: CollectionConfig): CollectionConfig {
  // Payload serves sign-in and file routes for these outside the access rules
  // set below, so the collection cannot be closed safely.
  if (collection.auth || collection.upload) {
    throw new ConfigurationError(
      `Plugin "${slug}" owns "${collection.slug}", which has sign-in or uploads. ` +
        'Payload serves those outside access rules, so this plugin cannot be disabled. Enable it in PT_PLUGINS.',
    )
  }
  const { hooks: _hooks, ...rest } = collection
  return {
    ...rest,
    admin: { ...collection.admin, hidden: true },
    access: { read: deny, create: deny, update: deny, delete: deny },
    endpoints: [],
    fields: withoutFieldHooks(collection.fields),
  }
}

function disableGlobal(global: GlobalConfig): GlobalConfig {
  const { hooks: _hooks, ...rest } = global
  return {
    ...rest,
    admin: { ...global.admin, hidden: true },
    access: { read: deny, update: deny },
    endpoints: [],
    fields: withoutFieldHooks(global.fields),
  }
}

const changedKeys = (value: unknown, previous: unknown): string[] => {
  const record = (v: unknown): Record<string, unknown> =>
    v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
  const next = record(value)
  const prev = record(previous)
  return [...new Set([...Object.keys(next), ...Object.keys(prev)])].filter(
    (key) => JSON.stringify(next[key]) !== JSON.stringify(prev[key]),
  )
}

/**
 * Logs a super-admin's change to fields a plugin owns (section 4.5, rule 3).
 * It records which fields changed, not their values, which may be sensitive.
 * Plugins write through the Local API with access rules off, so their own
 * writes are not overrides even when a user is attached to the request.
 */
const logOverride =
  (slug: string): FieldHook =>
  ({ req, value, previousValue, collection, originalDoc }) => {
    if (!isSuperAdmin(req.user)) return value
    const changed = changedKeys(value, previousValue)
    if (changed.length > 0) {
      req.payload.logger.warn({
        msg: `Super-admin override of fields owned by plugin "${slug}"`,
        collection: collection?.slug,
        id: originalDoc?.id,
        user: req.user?.id,
        fields: changed,
      })
    }
    return value
  }

/** The group that holds one plugin's fields on another plugin's record type. */
function ownedGroup(slug: string, fields: readonly Field[], enabled: boolean): Field {
  const nonOptional = nonOptionalFields(fields)
  if (nonOptional.length > 0) {
    throw new ConfigurationError(
      `Plugin "${slug}" adds fields that are required or need rows (${nonOptional.join(', ')}). ` +
        'Fields a plugin adds must be optional.',
    )
  }
  return {
    name: slug,
    type: 'group',
    fields: enabled ? [...fields] : withoutFieldHooks(fields),
    // A disabled plugin's fields are never written, by anyone (D29).
    access: { update: enabled ? superAdminOnly : deny },
    admin: enabled ? { readOnly: true } : { readOnly: true, condition: () => false },
    hooks: enabled ? { beforeChange: [logOverride(slug)] } : {},
  }
}

function extendCollections(
  collections: readonly CollectionConfig[],
  manifest: PluginManifest,
  enabled: boolean,
): CollectionConfig[] {
  // Entries for the same record type share one group.
  const byTarget = new Map<string, Field[]>()
  for (const { collection, fields } of manifest.extend ?? []) {
    byTarget.set(collection, [...(byTarget.get(collection) ?? []), ...fields])
  }
  const result = [...collections]
  for (const [target, fields] of byTarget) {
    const index = result.findIndex((c) => c.slug === target)
    const existing = result[index]
    if (!existing) {
      throw new ConfigurationError(
        `Plugin "${manifest.slug}" extends "${target}", which no earlier plugin defines. ` +
          'Load the plugin that owns it first.',
      )
    }
    if (existing.fields.some((f) => 'name' in f && f.name === manifest.slug)) {
      throw new ConfigurationError(
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

/** Logs a super-admin's change to one field a plugin has taken over. */
const logTakenOverChange =
  (slug: string, path: string): FieldHook =>
  ({ req, value, previousValue, collection, originalDoc }) => {
    if (!isSuperAdmin(req.user)) return value
    if (JSON.stringify(value) !== JSON.stringify(previousValue)) {
      req.payload.logger.warn({
        msg: `Super-admin override of a field taken over by plugin "${slug}"`,
        collection: collection?.slug,
        id: originalDoc?.id,
        user: req.user?.id,
        fields: [path],
      })
    }
    return value
  }

type Guarded = {
  access?: Record<string, unknown>
  admin?: Record<string, unknown>
  hooks?: { beforeChange?: FieldHook[] }
}

/** A core field as it is while a plugin has taken it over. Its other rules stay. */
function takenOver(slug: string, path: string, field: Field): Field {
  const current = field as Field & Guarded
  return {
    ...current,
    access: { ...current.access, update: superAdminOnly },
    admin: { ...current.admin, readOnly: true },
    hooks: {
      ...current.hooks,
      beforeChange: [...(current.hooks?.beforeChange ?? []), logTakenOverChange(slug, path)],
    },
  } as Field
}

/**
 * Replaces the field at a dotted path, or returns `undefined` when there is
 * none. A group or a named tab is one step of the path. Rows, collapsibles and
 * unnamed tabs hold fields without adding a step. Fields inside arrays and
 * blocks cannot be named this way.
 */
function replaceAtPath(
  fields: readonly Field[],
  path: readonly string[],
  replace: (field: Field) => Field,
): Field[] | undefined {
  const [head, ...rest] = path
  if (head === undefined) return undefined
  let found = false
  const next = fields.map((field): Field => {
    if (found) return field
    if (field.type === 'tabs') {
      const tabs = field.tabs.map((tab) => {
        if (found) return tab
        const named = 'name' in tab && typeof tab.name === 'string'
        if (named && tab.name !== head) return tab
        const replaced = replaceAtPath(tab.fields, named ? rest : path, replace)
        if (!replaced) return tab
        found = true
        return { ...tab, fields: replaced }
      })
      return found ? ({ ...field, tabs } as Field) : field
    }
    if ('name' in field && typeof field.name === 'string') {
      if (field.name !== head) return field
      if (rest.length === 0) {
        found = true
        return replace(field)
      }
      if (field.type !== 'group') return field
      const replaced = replaceAtPath(field.fields, rest, replace)
      if (!replaced) return field
      found = true
      return { ...field, fields: replaced } as Field
    }
    if ('fields' in field && Array.isArray(field.fields)) {
      const replaced = replaceAtPath(field.fields, path, replace)
      if (!replaced) return field
      found = true
      return { ...field, fields: replaced } as Field
    }
    return field
  })
  return found ? next : undefined
}

/**
 * Applies `takesOver`. A path that names nothing stops start-up whether or not
 * the plugin is enabled, so a typo shows up before the plugin is switched on.
 */
function takeOverFields(
  collections: readonly CollectionConfig[],
  manifest: PluginManifest,
  enabled: boolean,
): CollectionConfig[] {
  const result = [...collections]
  for (const { collection, fields } of manifest.takesOver ?? []) {
    const index = result.findIndex((c) => c.slug === collection)
    let target = result[index]
    if (!target) {
      throw new ConfigurationError(
        `Plugin "${manifest.slug}" takes over fields on "${collection}", which no earlier plugin defines. ` +
          'Load the plugin that owns it first.',
      )
    }
    for (const path of fields) {
      const replaced = replaceAtPath(target.fields, path.split('.'), (field) =>
        takenOver(manifest.slug, path, field),
      )
      if (!replaced) {
        throw new ConfigurationError(
          `Plugin "${manifest.slug}" takes over "${collection}.${path}", which does not exist.`,
        )
      }
      target = { ...target, fields: replaced }
    }
    if (enabled) result[index] = target
  }
  return result
}

/**
 * A disabled plugin's tasks stay registered, because Payload builds the jobs
 * table from task names, but they refuse to run, have no schedule, and fail
 * once rather than retrying a job queued before the plugin was disabled.
 */
function disableTask(slug: string, task: TaskConfig): TaskConfig {
  const { schedule: _schedule, onFail: _onFail, onSuccess: _onSuccess, ...rest } = task
  return {
    ...rest,
    retries: 0,
    handler: () => {
      throw new ConfigurationError(
        `Task "${task.slug}" belongs to plugin "${slug}", which is disabled.`,
      )
    },
  }
}

function disableWorkflow(slug: string, workflow: WorkflowConfig): WorkflowConfig {
  const { schedule: _schedule, ...rest } = workflow
  return {
    ...rest,
    retries: 0,
    handler: () => {
      throw new ConfigurationError(
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
        // Plugin credentials sit with users, in the administrators' part of the menu.
        admin: { group: 'Administration' },
        // No history: an old credential is replaced, never kept. Version history is
        // readable by every signed-in user (core's privateHistory), so it would
        // also widen who can see the settings.
        versions: false,
        // Settings hold credentials, so only super-admins can read them (section 7.10).
        access: {
          read: ({ req }) => isSuperAdmin(req.user),
          update: ({ req }) => isSuperAdmin(req.user),
        },
        // The kernel reuses the settings it read. A save here makes it read again.
        hooks: {
          afterChange: [
            ({ doc, req }) => {
              forgetSettings(req.payload)
              return doc
            },
          ],
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
    enabled ? c : disableCollection(slug, c),
  )
  const ownGlobals = (manifest.globals ?? []).map((g) => (enabled ? g : disableGlobal(g)))
  const tasks = (manifest.tasks ?? []).map((t) => (enabled ? t : disableTask(slug, t)))
  const workflows = (manifest.workflows ?? []).map((w) => (enabled ? w : disableWorkflow(slug, w)))

  const next: Config = {
    ...config,
    collections: takeOverFields(
      extendCollections([...(config.collections ?? []), ...ownCollections], manifest, enabled),
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

/** Later than any plugin's own order. */
const LAST = 1_000_000

/**
 * A rule applied to the whole config after every plugin has added its record
 * types, such as "version history is for signed-in users". Payload runs
 * plugins by `order`, not by their place in the list, so a plain function
 * placed last would still run before plugins with a higher order.
 */
export function defineFinalPlugin(slug: string, apply: (config: Config) => Config): Plugin {
  return definePlugin({
    slug: `promisetracker-${slug}`,
    order: LAST,
    plugin: ({ config }) => apply(config),
  })()
}

/**
 * Defines a PromiseTracker plugin: Payload's `definePlugin`, plus the manifest
 * in section 4.3. The kernel decides whether it is enabled.
 */
export function definePromiseTrackerPlugin(manifest: PluginManifest): PromiseTrackerPlugin {
  if (!/^[a-z][a-z0-9-]*$/.test(manifest.slug)) {
    throw new ConfigurationError(
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
