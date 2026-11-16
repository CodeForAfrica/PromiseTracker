import type { Payload, Plugin } from 'payload'

import type { Env, KernelEnv } from './env'
import { readKernelEnv } from './env'
import { KernelError } from './errors'
import type { PluginManifest, PromiseTrackerPlugin } from './plugin'
import { SETTINGS_GLOBAL } from './plugin'
import type {
  AdapterContext,
  AnalyticsProvider,
  CaptchaProvider,
  ContentExtractor,
  LLMProvider,
  NewsletterProvider,
  PortAdapters,
  PortName,
  SearchProvider,
  SourceConnector,
  StructuredImporter,
  VerificationProvider,
} from './ports'
import { PORTS } from './ports'

/** The adapters that run, one entry per port (section 4.1). */
export interface ResolvedAdapters {
  verification: VerificationProvider
  sourceConnector: readonly SourceConnector[]
  contentExtractor: readonly ContentExtractor[]
  structuredImporter: readonly StructuredImporter[]
  llm: { adapter: LLMProvider; model: string } | null
  search: SearchProvider
  newsletter: NewsletterProvider
  analytics: AnalyticsProvider
  captcha: CaptchaProvider
}

export interface Kernel {
  readonly env: KernelEnv
  /** Enabled plugin slugs, in load order. */
  readonly enabled: readonly string[]
  readonly adapters: ResolvedAdapters
  /** One Payload plugin per PromiseTracker plugin, enabled or not (D29). */
  readonly payloadPlugins: readonly Plugin[]
  readonly manifests: readonly PluginManifest[]
  isEnabled(slug: string): boolean
  /** Adapter ids by port, for health checks and logs. */
  ports(): Record<PortName, string[]>
  /** The final configuration in one line (section 4.4, step 8). */
  summary(): string
  /** Start-up checks that need a running Payload (section 4.4, steps 6 to 8). */
  onInit(payload: Payload): Promise<void>
  /** The context an adapter method receives, with one plugin's settings. */
  context(payload: Payload, pluginSlug: string, signal?: AbortSignal): Promise<AdapterContext>
}

export interface KernelOptions {
  /** Every first-party plugin, enabled or not. */
  plugins: readonly PromiseTrackerPlugin[]
  /** Defaults to process.env, read once. */
  env?: Env
  /** The plugin whose adapters are defaults. */
  defaultsFrom?: string
}

type GlobalSlugParam = Parameters<Payload['findGlobal']>[0]['slug']

type Candidate<P extends PortName> = { plugin: string; adapter: PortAdapters[P] }

const list = (values: readonly string[]): string => values.map((v) => `"${v}"`).join(', ')

/** Checks that each enabled plugin's dependencies exist, are enabled and load first. */
function checkDependencies(
  manifests: readonly PluginManifest[],
  enabled: ReadonlySet<string>,
): void {
  const bySlug = new Map(manifests.map((m) => [m.slug, m]))
  for (const m of manifests) {
    for (const dep of m.dependsOn ?? []) {
      if (!bySlug.has(dep)) {
        throw new KernelError(`Plugin "${m.slug}" depends on "${dep}", which does not exist.`)
      }
    }
  }

  // Before the order check, which a cycle also breaks, because naming the
  // cycle says more.
  const visiting = new Set<string>()
  const done = new Set<string>()
  const visit = (slug: string, path: readonly string[]): void => {
    if (done.has(slug)) return
    if (visiting.has(slug)) {
      throw new KernelError(`Circular plugin dependency: ${[...path, slug].join(' -> ')}.`)
    }
    visiting.add(slug)
    for (const dep of bySlug.get(slug)?.dependsOn ?? []) visit(dep, [...path, slug])
    visiting.delete(slug)
    done.add(slug)
  }
  for (const m of manifests) visit(m.slug, [])

  for (const m of manifests) {
    for (const dep of m.dependsOn ?? []) {
      const target = bySlug.get(dep)
      if (enabled.has(m.slug) && !enabled.has(dep)) {
        throw new KernelError(
          `Plugin "${m.slug}" needs "${dep}". Add "${dep}" to PT_PLUGINS or remove "${m.slug}".`,
        )
      }
      if (target && target.order >= m.order) {
        throw new KernelError(
          `Plugin "${m.slug}" (order ${m.order}) depends on "${dep}" (order ${target.order}), ` +
            'so it must load later. Give it a higher order.',
        )
      }
    }
  }
}

function candidates<P extends PortName>(
  port: P,
  manifests: readonly PluginManifest[],
  enabled: ReadonlySet<string>,
): Candidate<P>[] {
  return manifests
    .filter((m) => enabled.has(m.slug))
    .flatMap((m) => {
      const provided: readonly PortAdapters[P][] = m.provides?.[port] ?? []
      return provided.map((adapter) => ({ plugin: m.slug, adapter }))
    })
}

/**
 * Picks the one adapter for a port that runs exactly one. The selector, when
 * set, decides. Otherwise core's default gives way to a single adapter from
 * another plugin, and two or more others need the selector.
 */
function pickOne<P extends PortName>(
  port: P,
  found: readonly Candidate<P>[],
  defaultsFrom: string,
  selected: string | undefined,
): PortAdapters[P] {
  const { name } = PORTS[port]
  const selector = 'selector' in PORTS[port] ? PORTS[port].selector : undefined
  const ids = found.map((c) => c.adapter.id)
  if (found.length === 0) {
    throw new KernelError(`No plugin provides a ${name}. Enable one in PT_PLUGINS.`)
  }
  if (selected !== undefined) {
    const match = found.find((c) => c.adapter.id === selected)
    if (!match) {
      throw new KernelError(
        `${selector} is "${selected}", but the ${name} adapters available are ${list(ids)}.`,
      )
    }
    return match.adapter
  }
  const others = found.filter((c) => c.plugin !== defaultsFrom)
  const [onlyOther] = others
  if (others.length === 1 && onlyOther) return onlyOther.adapter
  const [onlyOne] = found
  if (found.length === 1 && onlyOne) return onlyOne.adapter
  if (others.length === 0 && found.length > 1) {
    throw new KernelError(`More than one default ${name}: ${list(ids)}.`)
  }
  const chooser = selector ?? 'PT_PLUGINS'
  throw new KernelError(
    `More than one ${name} is enabled: ${list(others.map((c) => c.adapter.id))}. ` +
      (selector ? `Set ${chooser} to one of them.` : `Remove all but one from ${chooser}.`),
  )
}

function pickLlm(
  found: readonly Candidate<'llm'>[],
  model: string | undefined,
): ResolvedAdapters['llm'] {
  if (found.length === 0) return null
  const ids = found.map((c) => c.adapter.id)
  if (!model) {
    throw new KernelError(
      `PT_LLM_MODEL is not set. Set it to provider:model, where provider is one of ${list(ids)}.`,
    )
  }
  const separator = model.indexOf(':')
  const provider = separator > 0 ? model.slice(0, separator) : ''
  const modelName = separator > 0 ? model.slice(separator + 1) : ''
  const match = found.find((c) => c.adapter.id === provider)
  if (!match || !modelName) {
    throw new KernelError(
      `PT_LLM_MODEL is "${model}". It must be provider:model, where provider is one of ${list(ids)}.`,
    )
  }
  return { adapter: match.adapter, model: modelName }
}

export function createKernel(options: KernelOptions): Kernel {
  const env = readKernelEnv(options.env)
  const defaultsFrom = options.defaultsFrom ?? 'core'
  const manifests = [...options.plugins.map((p) => p.manifest)].sort((a, b) => a.order - b.order)

  const known = new Set(manifests.map((m) => m.slug))
  if (known.size !== manifests.length) {
    throw new KernelError('Two plugins share a slug. Each plugin needs its own.')
  }
  const unknown = env.plugins.filter((slug) => !known.has(slug))
  if (unknown.length > 0) {
    throw new KernelError(
      `PT_PLUGINS names unknown plugins: ${list(unknown)}. Known plugins: ${list([...known])}.`,
    )
  }
  if (!env.plugins.includes(defaultsFrom)) {
    throw new KernelError(`PT_PLUGINS must include "${defaultsFrom}".`)
  }
  const enabledSet = new Set(env.plugins)
  checkDependencies(manifests, enabledSet)

  const adapters: ResolvedAdapters = {
    verification: pickOne(
      'verification',
      candidates('verification', manifests, enabledSet),
      defaultsFrom,
      env.verification,
    ),
    sourceConnector: candidates('sourceConnector', manifests, enabledSet).map((c) => c.adapter),
    contentExtractor: candidates('contentExtractor', manifests, enabledSet).map((c) => c.adapter),
    structuredImporter: candidates('structuredImporter', manifests, enabledSet).map(
      (c) => c.adapter,
    ),
    llm: pickLlm(candidates('llm', manifests, enabledSet), env.llmModel),
    search: pickOne('search', candidates('search', manifests, enabledSet), defaultsFrom, undefined),
    newsletter: pickOne(
      'newsletter',
      candidates('newsletter', manifests, enabledSet),
      defaultsFrom,
      undefined,
    ),
    analytics: pickOne(
      'analytics',
      candidates('analytics', manifests, enabledSet),
      defaultsFrom,
      undefined,
    ),
    captcha: pickOne(
      'captcha',
      candidates('captcha', manifests, enabledSet),
      defaultsFrom,
      undefined,
    ),
  }
  if (adapters.contentExtractor.length === 0) {
    throw new KernelError(`No plugin provides a ${PORTS.contentExtractor.name}.`)
  }

  const enabled = manifests.filter((m) => enabledSet.has(m.slug)).map((m) => m.slug)
  const payloadPlugins = options.plugins.map((p) =>
    p.toPayloadPlugin(enabledSet.has(p.manifest.slug)),
  )

  const ports = (): Record<PortName, string[]> => ({
    verification: [adapters.verification.id],
    sourceConnector: adapters.sourceConnector.map((a) => a.id),
    contentExtractor: adapters.contentExtractor.map((a) => a.id),
    structuredImporter: adapters.structuredImporter.map((a) => a.id),
    llm: adapters.llm ? [`${adapters.llm.adapter.id}:${adapters.llm.model}`] : [],
    search: [adapters.search.id],
    newsletter: [adapters.newsletter.id],
    analytics: [adapters.analytics.id],
    captcha: [adapters.captcha.id],
  })

  const summary = (): string => {
    const portList = Object.entries(ports())
      .map(([port, ids]) => `${port}=${ids.length ? ids.join('+') : 'none'}`)
      .join(' ')
    return `PromiseTracker plugins=${enabled.join(',')} ${portList}`
  }

  const settingsFor = async (
    payload: Payload,
    slug: string,
  ): Promise<Readonly<Record<string, unknown>>> => {
    // The settings global exists only once a plugin declares settings.
    const globalSlugs: readonly string[] = payload.config.globals.map((g) => g.slug)
    if (!globalSlugs.includes(SETTINGS_GLOBAL)) return {}
    // The kernel cannot see the app's generated global names, so it names this
    // one through Payload's own parameter type. Settings hold credentials, and
    // the kernel reads them as the system.
    const settings = await payload.findGlobal({
      slug: SETTINGS_GLOBAL as GlobalSlugParam,
      overrideAccess: true,
    })
    const own: unknown = Reflect.get(settings, slug)
    return own && typeof own === 'object' ? (own as Record<string, unknown>) : {}
  }

  const context = async (payload: Payload, pluginSlug: string, signal?: AbortSignal) => ({
    payload,
    logger: payload.logger,
    signal: signal ?? new AbortController().signal,
    settings: await settingsFor(payload, pluginSlug),
  })

  const onInit = async (payload: Payload): Promise<void> => {
    const processEnv = options.env ?? process.env
    const missing = manifests
      .filter((m) => enabledSet.has(m.slug))
      .flatMap((m) =>
        (m.requiredEnv ?? [])
          .filter((name) => !processEnv[name])
          .map((name) => `${name} (${m.slug})`),
      )
    if (missing.length > 0) {
      throw new KernelError(
        `Missing environment variables for enabled plugins: ${missing.join(', ')}.`,
      )
    }
    for (const m of manifests) {
      if (enabledSet.has(m.slug) && m.checkSettings) {
        await m.checkSettings(await context(payload, m.slug))
      }
    }
    payload.logger.info(summary())
  }

  return Object.freeze({
    env,
    enabled: Object.freeze(enabled),
    adapters,
    payloadPlugins: Object.freeze(payloadPlugins),
    manifests: Object.freeze(manifests),
    isEnabled: (slug: string) => enabledSet.has(slug),
    ports,
    summary,
    onInit,
    context,
  })
}
