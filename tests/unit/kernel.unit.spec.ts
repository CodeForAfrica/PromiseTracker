import type {
  ImportRow,
  LLMProvider,
  LLMResult,
  PluginManifest,
  SearchProvider,
  StructuredImporter,
  VerdictUpdate,
  VerificationProvider,
} from '@promisetracker/kernel'
import {
  applyManifest,
  ConfigurationError,
  createKernel,
  defineFinalPlugin,
  definePromiseTrackerPlugin,
  forgetSettings,
  PortResolutionError,
  pluginRoute,
  readEnabledPlugins,
  readKernelEnv,
  readLocales,
  readSettings,
  SETTINGS_TTL_MS,
} from '@promisetracker/kernel'
import { corePlugin } from '@promisetracker/plugin-core'
import { sitePlugin } from '@promisetracker/plugin-site'
import type { CollectionConfig, Config, Field, Payload } from 'payload'
import { describe, expect, it, vi } from 'vitest'

// Test plugins. Each proves one rule, without a real integration.

const healthy = async () => ({ healthy: true })
const unused = () => Promise.reject(new Error('not used in tests'))

const verifier = (id: string): VerificationProvider => ({
  id,
  health: healthy,
  submit: unused,
  pull: unused,
})
const searcher = (id: string): SearchProvider => ({
  id,
  health: healthy,
  search: unused,
  resolvePlace: unused,
  index: unused,
})
const llm = (id: string): LLMProvider => ({
  id,
  models: ['model-x'],
  health: healthy,
  generate: unused,
})

const plugin = (manifest: Partial<PluginManifest> & Pick<PluginManifest, 'slug'>) =>
  definePromiseTrackerPlugin({ version: '0.0.0', order: 50, dependsOn: ['core'], ...manifest })

const kernelWith = (plugins: ReturnType<typeof plugin>[], env: Record<string, string> = {}) =>
  createKernel({ plugins: [corePlugin, sitePlugin, ...plugins], env })

const enabling = (...slugs: string[]) => ({ PT_PLUGINS: ['core', 'site', ...slugs].join(',') })

describe('reading the environment', () => {
  it('defaults to core and site', () => {
    expect(readEnabledPlugins({})).toEqual(['core', 'site'])
  })

  it('reads PT_PLUGINS, trimming spaces and dropping repeats', () => {
    expect(readEnabledPlugins({ PT_PLUGINS: ' core, site ,tika,core' })).toEqual([
      'core',
      'site',
      'tika',
    ])
  })

  it('reads the four selecting variables once, into a frozen object', () => {
    const env = readKernelEnv({
      PT_VERIFICATION: ' check ',
      PT_LLM_MODEL: 'google:gemini',
      PT_LOCALES: 'en, FR,fr',
    })
    expect(env).toEqual({
      plugins: ['core', 'site'],
      verification: 'check',
      llmModel: 'google:gemini',
      locales: ['en', 'fr'],
    })
    expect(Object.isFrozen(env)).toBe(true)
  })
})

describe('the default set-up', () => {
  const kernel = kernelWith([])

  it('enables core and site, in load order', () => {
    expect(kernel.enabled).toEqual(['core', 'site'])
  })

  it("uses core's adapters", () => {
    expect(kernel.ports()).toEqual({
      verification: ['native'],
      sourceConnector: ['upload', 'url'],
      contentExtractor: ['plaintext'],
      structuredImporter: ['csv', 'xlsx'],
      llm: [],
      search: ['payload-search'],
      newsletter: ['local'],
      analytics: ['none'],
      captcha: ['local'],
    })
  })

  it('describes the configuration in one line', () => {
    const line = kernel.summary()
    expect(line).not.toContain('\n')
    expect(line).toContain('plugins=core,site')
    expect(line).toContain('verification=native')
    expect(line).toContain('llm=none')
  })
})

describe('start-up failures', () => {
  it('stops on an unknown plugin and lists the known ones', () => {
    expect(() => kernelWith([], { PT_PLUGINS: 'core,site,nope' })).toThrow(
      /unknown plugins: "nope". Known plugins: "core", "site"/,
    )
  })

  it('stops when core is not enabled', () => {
    expect(() => kernelWith([], { PT_PLUGINS: 'site' })).toThrow(/must include "core"/)
  })

  it('stops when an enabled plugin needs a disabled one', () => {
    const extra = plugin({ slug: 'extra', dependsOn: ['core', 'helper'] })
    const helper = plugin({ slug: 'helper', order: 40 })
    expect(() => kernelWith([helper, extra], enabling('extra'))).toThrow(
      'Plugin "extra" needs "helper". Add "helper" to PT_PLUGINS or remove "extra".',
    )
  })

  it('stops when a plugin depends on one that does not exist', () => {
    expect(() => kernelWith([plugin({ slug: 'lonely', dependsOn: ['ghost'] })])).toThrow(
      'depends on "ghost", which does not exist',
    )
  })

  it('stops when a plugin would load before its dependency', () => {
    const early = plugin({ slug: 'early', order: 1, dependsOn: ['late'] })
    const late = plugin({ slug: 'late', order: 2 })
    expect(() => kernelWith([early, late])).toThrow(/must load later/)
  })

  it('stops on a circular dependency and names the cycle', () => {
    const a = plugin({ slug: 'loop-a', order: 20, dependsOn: ['loop-b'] })
    const b = plugin({ slug: 'loop-b', order: 30, dependsOn: ['loop-a'] })
    expect(() => kernelWith([a, b])).toThrow(ConfigurationError)
    expect(() => kernelWith([a, b])).toThrow(
      /Circular plugin dependency: loop-a -> loop-b -> loop-a/,
    )
  })

  it('stops on two plugins with one slug', () => {
    expect(() => kernelWith([plugin({ slug: 'site' })])).toThrow(/share a slug/)
  })

  it('rejects a slug that is not lower case', () => {
    expect(() => plugin({ slug: 'Bad Slug' })).toThrow(/lower case/)
  })
})

describe('choosing adapters', () => {
  const alt = plugin({ slug: 'alt', provides: { verification: [verifier('alt')] } })
  const other = plugin({ slug: 'other', provides: { verification: [verifier('other')] } })

  it("lets an enabled plugin's adapter replace core's default", () => {
    expect(kernelWith([alt], enabling('alt')).adapters.verification.id).toBe('alt')
  })

  it("keeps core's default while the plugin is disabled", () => {
    expect(kernelWith([alt]).adapters.verification.id).toBe('native')
  })

  it('stops when two plugins offer one and names them and PT_VERIFICATION', () => {
    expect(() => kernelWith([alt, other], enabling('alt', 'other'))).toThrow(PortResolutionError)
    expect(() => kernelWith([alt, other], enabling('alt', 'other'))).toThrow(
      'More than one VerificationProvider is enabled: "alt", "other". Set PT_VERIFICATION to one of them.',
    )
  })

  it('uses PT_VERIFICATION to choose', () => {
    const kernel = kernelWith([alt, other], {
      ...enabling('alt', 'other'),
      PT_VERIFICATION: 'other',
    })
    expect(kernel.adapters.verification.id).toBe('other')
  })

  it('stops when PT_VERIFICATION names an adapter that is not available', () => {
    expect(() => kernelWith([alt], { ...enabling('alt'), PT_VERIFICATION: 'check' })).toThrow(
      'PT_VERIFICATION is "check", but the VerificationProvider adapters available are "native", "alt".',
    )
  })

  it('stops when two plugins offer search and points at PT_PLUGINS', () => {
    const s1 = plugin({ slug: 'search-one', provides: { search: [searcher('one')] } })
    const s2 = plugin({ slug: 'search-two', provides: { search: [searcher('two')] } })
    expect(() => kernelWith([s1, s2], enabling('search-one', 'search-two'))).toThrow(
      'Remove all but one from PT_PLUGINS.',
    )
  })

  describe('the AI model', () => {
    const ai = plugin({ slug: 'fake-ai', provides: { llm: [llm('fake')] } })

    it('is none when no AI plugin is enabled', () => {
      expect(kernelWith([ai]).adapters.llm).toBeNull()
    })

    it('stops when an AI plugin is enabled without PT_LLM_MODEL', () => {
      expect(() => kernelWith([ai], enabling('fake-ai'))).toThrow(/PT_LLM_MODEL is not set/)
    })

    it('reads provider:model from PT_LLM_MODEL', () => {
      const kernel = kernelWith([ai], { ...enabling('fake-ai'), PT_LLM_MODEL: 'fake:model-x' })
      expect(kernel.adapters.llm?.adapter.id).toBe('fake')
      expect(kernel.adapters.llm?.model).toBe('model-x')
      expect(kernel.ports().llm).toEqual(['fake:model-x'])
    })

    it('stops on an unknown provider', () => {
      expect(() =>
        kernelWith([ai], { ...enabling('fake-ai'), PT_LLM_MODEL: 'other:model' }),
      ).toThrow(/provider is one of "fake"/)
    })
  })
})

// A test plugin with one of everything that touches the Payload config.
const task = vi.fn(async () => ({ output: {} }))
const fullManifest: PluginManifest = {
  slug: 'full',
  version: '0.0.0',
  order: 50,
  dependsOn: ['core'],
  collections: [
    {
      slug: 'full-items',
      fields: [{ name: 'title', type: 'text', hooks: { beforeChange: [({ value }) => value] } }],
      hooks: { afterChange: [() => undefined] },
    },
  ],
  extend: [{ collection: 'users', fields: [{ name: 'externalId', type: 'text' }] }],
  tasks: [
    { slug: 'full-sync', handler: task, schedule: [{ cron: '* * * * *', queue: 'default' }] },
  ],
  settings: [{ name: 'apiKey', type: 'text' }],
  widgets: [{ slug: 'full-widget', Component: '@promisetracker/full#Widget' }],
  routes: [{ path: 'webhook', methods: ['POST'], description: 'Test pushes' }],
}

const baseConfig = (): Config => ({
  collections: [{ slug: 'users', auth: true, fields: [] }],
  globals: [],
  secret: 'x',
  db: undefined as unknown as Config['db'],
})

const collection = (config: Config, slug: string): CollectionConfig => {
  const found = config.collections?.find((c) => c.slug === slug)
  if (!found) throw new Error(`no collection ${slug}`)
  return found
}
const fieldNamed = (fields: readonly Field[], name: string): Field => {
  const found = fields.find((f) => 'name' in f && f.name === name)
  if (!found) throw new Error(`no field ${name}`)
  return found
}

describe('a plugin switched on and off', () => {
  const on = applyManifest(baseConfig(), fullManifest, true)
  const off = applyManifest(baseConfig(), fullManifest, false)

  it('registers the same record types and fields either way (D29)', () => {
    const shape = (config: Config) => ({
      collections: config.collections?.map((c) => [
        c.slug,
        c.fields.map((f) => ('name' in f ? f.name : f.type)),
      ]),
      globals: config.globals?.map((g) => [
        g.slug,
        g.fields.map((f) => ('name' in f ? f.name : f.type)),
      ]),
      tasks: config.jobs?.tasks?.map((t) => t.slug),
    })
    expect(shape(off)).toEqual(shape(on))
  })

  it('keeps hooks only when enabled', () => {
    expect(collection(on, 'full-items').hooks?.afterChange).toHaveLength(1)
    expect(collection(off, 'full-items').hooks).toBeUndefined()
    expect(fieldNamed(collection(off, 'full-items').fields, 'title')).not.toHaveProperty('hooks')
  })

  it('hides a disabled plugin in the admin and closes its records', () => {
    expect(collection(on, 'full-items').admin?.hidden).toBeUndefined()
    expect(collection(off, 'full-items').admin?.hidden).toBe(true)
    expect(collection(off, 'full-items').access?.read).toBeTypeOf('function')
  })

  it('puts added fields in a read-only group named after the plugin', () => {
    const group = fieldNamed(collection(on, 'users').fields, 'full')
    expect(group).toMatchObject({ type: 'group', admin: { readOnly: true } })
    expect(group).toHaveProperty('hooks.beforeChange')
    const hidden = fieldNamed(collection(off, 'users').fields, 'full')
    expect(hidden).toHaveProperty('admin.condition')
  })

  it('keeps tasks registered but refuses to run them when disabled', () => {
    const offTask = off.jobs?.tasks?.[0]
    if (!offTask || typeof offTask.handler !== 'function') throw new Error('task not registered')
    const handler = offTask.handler as () => unknown
    expect(offTask.slug).toBe('full-sync')
    expect(offTask).not.toHaveProperty('schedule')
    expect(() => handler()).toThrow(/disabled/)
    expect(on.jobs?.tasks?.[0]).toHaveProperty('schedule')
  })

  it('adds widgets only when enabled', () => {
    expect(on.admin?.dashboard?.widgets).toHaveLength(1)
    expect(off.admin?.dashboard).toBeUndefined()
  })

  it("keeps a disabled plugin's settings editable, marked as not in use", () => {
    const settings = (config: Config) => config.globals?.find((g) => g.slug === 'settings')
    const onGroup = fieldNamed(settings(on)?.fields ?? [], 'full')
    const offGroup = fieldNamed(settings(off)?.fields ?? [], 'full')
    expect(onGroup).not.toHaveProperty('admin.condition')
    expect(offGroup).not.toHaveProperty('admin.condition')
    const description = (offGroup as { admin?: { description?: unknown } }).admin?.description
    expect(typeof description === 'function' ? description({}) : description).toContain(
      'Not in use',
    )
    expect(settings(off)?.admin).not.toHaveProperty('hidden')
  })

  it('keeps no history of the settings, so old credentials are not kept', () => {
    const settings = on.globals?.find((g) => g.slug === 'settings')
    expect(settings?.versions).toBe(false)
  })

  it("refuses required fields on another plugin's record type", () => {
    const bad: PluginManifest = {
      ...fullManifest,
      extend: [{ collection: 'users', fields: [{ name: 'must', type: 'text', required: true }] }],
    }
    expect(() => applyManifest(baseConfig(), bad, true)).toThrow(/must be optional/)
  })

  it('refuses to extend a record type no earlier plugin defines', () => {
    const bad: PluginManifest = { ...fullManifest, extend: [{ collection: 'ghosts', fields: [] }] }
    expect(() => applyManifest(baseConfig(), bad, true)).toThrow(/no earlier plugin defines/)
  })
})

describe('the schema does not depend on PT_PLUGINS', () => {
  const build = async (env: Record<string, string>) => {
    const kernel = createKernel({ plugins: [corePlugin, sitePlugin], env })
    let config = baseConfig()
    config.collections = []
    for (const p of kernel.payloadPlugins) config = await p(config)
    return {
      collections: config.collections?.map((c) => c.slug),
      globals: config.globals?.map((g) => g.slug),
    }
  }

  it('registers site even when it is disabled', async () => {
    expect(await build({ PT_PLUGINS: 'core' })).toEqual(await build({ PT_PLUGINS: 'core,site' }))
  })
})

describe('start-up checks at init', () => {
  const fakePayload = () => {
    const info = vi.fn()
    const payload = { logger: { info, warn: vi.fn(), error: vi.fn() }, config: { globals: [] } }
    return { payload: payload as unknown as Payload, info }
  }

  it('stops when an enabled plugin is missing an environment variable', async () => {
    const needy = plugin({ slug: 'needy', requiredEnv: ['NEEDY_KEY'] })
    const kernel = kernelWith([needy], enabling('needy'))
    await expect(kernel.onInit(fakePayload().payload)).rejects.toThrow('NEEDY_KEY (needy)')
  })

  it('ignores the variables of a disabled plugin', async () => {
    const needy = plugin({ slug: 'needy', requiredEnv: ['NEEDY_KEY'] })
    await expect(kernelWith([needy]).onInit(fakePayload().payload)).resolves.toBeUndefined()
  })

  it("runs an enabled plugin's settings check, then logs the summary", async () => {
    const checkSettings = vi.fn(async () => {})
    const checked = plugin({ slug: 'checked', checkSettings })
    const kernel = kernelWith([checked], enabling('checked'))
    const { payload, info } = fakePayload()
    await kernel.onInit(payload)
    expect(checkSettings).toHaveBeenCalledOnce()
    expect(info).toHaveBeenCalledWith(kernel.summary())
  })

  it("skips a disabled plugin's settings check", async () => {
    const checkSettings = vi.fn(async () => {})
    await kernelWith([plugin({ slug: 'checked', checkSettings })]).onInit(fakePayload().payload)
    expect(checkSettings).not.toHaveBeenCalled()
  })
})

describe('plugin routes', () => {
  const handler = async () => Response.json({ ok: true })

  it('answers 503 while the plugin is disabled', async () => {
    const route = pluginRoute({ isEnabled: () => false }, 'check', handler)
    const res = await route(new Request('http://x/api/plugins/check/webhook'))
    expect(res.status).toBe(503)
  })

  it('passes through when the plugin is enabled', async () => {
    const route = pluginRoute({ isEnabled: () => true }, 'check', handler)
    expect((await route(new Request('http://x/api/plugins/check/webhook'))).status).toBe(200)
  })
})

describe('review follow-ups', () => {
  const extendWith = (fields: Field[]): PluginManifest => ({
    slug: 'ext',
    version: '0.0.0',
    order: 50,
    extend: [{ collection: 'users', fields }],
  })

  it('refuses a required field nested in a group, a tab or a block', () => {
    const nested: Field[][] = [
      [{ name: 'g', type: 'group', fields: [{ name: 'deep', type: 'text', required: true }] }],
      [
        {
          type: 'tabs',
          tabs: [{ label: 'T', fields: [{ name: 'deep', type: 'text', required: true }] }],
        },
      ],
      [
        {
          name: 'b',
          type: 'blocks',
          blocks: [{ slug: 'blk', fields: [{ name: 'deep', type: 'text', required: true }] }],
        },
      ],
    ]
    for (const fields of nested) {
      expect(() => applyManifest(baseConfig(), extendWith(fields), true)).toThrow(/deep/)
    }
  })

  it('refuses an array that needs rows', () => {
    const fields: Field[] = [
      { name: 'list', type: 'array', minRows: 1, fields: [{ name: 'x', type: 'text' }] },
    ]
    expect(() => applyManifest(baseConfig(), extendWith(fields), true)).toThrow(/list/)
  })

  const blockHook = vi.fn(({ value }: { value?: unknown }) => value)
  const withBlocks: PluginManifest = {
    slug: 'blocky',
    version: '0.0.0',
    order: 50,
    collections: [
      {
        slug: 'blocky-items',
        endpoints: [{ path: '/custom', method: 'get', handler: async () => Response.json({}) }],
        fields: [
          {
            name: 'content',
            type: 'blocks',
            blocks: [
              {
                slug: 'para',
                fields: [{ name: 'text', type: 'text', hooks: { beforeChange: [blockHook] } }],
              },
            ],
          },
        ],
      },
    ],
    tasks: [
      {
        slug: 'blocky-task',
        handler: async () => ({ output: {} }),
        retries: 5,
        onFail: async () => {},
      },
    ],
  }

  it('strips hooks inside blocks of a disabled plugin', () => {
    const off = collection(applyManifest(baseConfig(), withBlocks, false), 'blocky-items')
    const content = fieldNamed(off.fields, 'content')
    expect(JSON.stringify(content)).not.toContain('hooks')
    const on = collection(applyManifest(baseConfig(), withBlocks, true), 'blocky-items')
    expect(JSON.stringify(fieldNamed(on.fields, 'content'))).toContain('hooks')
  })

  it("removes a disabled plugin's custom endpoints, which skip access rules", () => {
    expect(
      collection(applyManifest(baseConfig(), withBlocks, false), 'blocky-items').endpoints,
    ).toEqual([])
    expect(
      collection(applyManifest(baseConfig(), withBlocks, true), 'blocky-items').endpoints,
    ).toHaveLength(1)
  })

  it('makes a disabled task fail once, without retries or callbacks', () => {
    const offTask = applyManifest(baseConfig(), withBlocks, false).jobs?.tasks?.[0]
    expect(offTask?.retries).toBe(0)
    expect(offTask).not.toHaveProperty('onFail')
  })

  it("closes a disabled plugin's added fields to everyone, super-admins included", () => {
    const off = applyManifest(baseConfig(), fullManifest, false)
    const group = fieldNamed(collection(off, 'users').fields, 'full')
    const update = 'access' in group ? group.access?.update : undefined
    const superAdmin = { id: 'u1', roles: ['super-admin'] }
    expect(update?.({ req: { user: superAdmin } } as never)).toBe(false)
  })

  describe('override logging', () => {
    const on = applyManifest(baseConfig(), fullManifest, true)
    const group = fieldNamed(collection(on, 'users').fields, 'full')
    const hook = 'hooks' in group ? group.hooks?.beforeChange?.[0] : undefined
    const run = (user: unknown) => {
      const warn = vi.fn()
      hook?.({
        req: { user, payload: { logger: { warn } } },
        value: { externalId: 'new-secret' },
        previousValue: { externalId: 'old-secret' },
        collection: { slug: 'users' },
        originalDoc: { id: 'doc1' },
      } as never)
      return warn
    }

    it('logs a super-admin change by field name, without the values', () => {
      const warn = run({ id: 'u1', roles: ['super-admin'] })
      expect(warn).toHaveBeenCalledOnce()
      const entry = JSON.stringify(warn.mock.calls[0])
      expect(entry).toContain('externalId')
      expect(entry).not.toContain('secret')
    })

    it('does not log writes by anyone else', () => {
      expect(run({ id: 'u2', roles: ['editor'] })).not.toHaveBeenCalled()
    })
  })

  it('warns at start-up when PT_LLM_MODEL is set with no AI plugin', async () => {
    const warn = vi.fn()
    const payload = { logger: { info: vi.fn(), warn, error: vi.fn() }, config: { globals: [] } }
    await kernelWith([], { PT_LLM_MODEL: 'google:gemini' }).onInit(payload as unknown as Payload)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('no AI plugin is enabled'))
  })
})

describe('second review follow-ups', () => {
  it('refuses to disable a plugin that owns a sign-in or upload collection', () => {
    const owner: PluginManifest = {
      slug: 'accounts',
      version: '0.0.0',
      order: 50,
      collections: [{ slug: 'members', auth: true, fields: [] }],
    }
    expect(() => applyManifest(baseConfig(), owner, false)).toThrow(/cannot be disabled/)
    expect(() => applyManifest(baseConfig(), owner, true)).not.toThrow()
  })

  it('merges two extend entries for one collection into one group', () => {
    const twice: PluginManifest = {
      slug: 'twice',
      version: '0.0.0',
      order: 50,
      extend: [
        { collection: 'users', fields: [{ name: 'a', type: 'text' }] },
        { collection: 'users', fields: [{ name: 'b', type: 'text' }] },
      ],
    }
    const users = collection(applyManifest(baseConfig(), twice, true), 'users')
    const group = fieldNamed(users.fields, 'twice')
    expect('fields' in group ? group.fields.map((f) => ('name' in f ? f.name : '')) : []).toEqual([
      'a',
      'b',
    ])
  })

  it("stops when a plugin extends a collection whose owner isn't in its dependsOn", () => {
    const owner = plugin({ slug: 'owner', collections: [{ slug: 'things', fields: [] }] })
    const extender = plugin({
      slug: 'extender',
      order: 60,
      extend: [{ collection: 'things', fields: [{ name: 'x', type: 'text' }] }],
    })
    expect(() => kernelWith([owner, extender])).toThrow('Add "owner" to its dependsOn.')
    const fixed = plugin({
      slug: 'extender',
      order: 60,
      dependsOn: ['core', 'owner'],
      extend: [{ collection: 'things', fields: [{ name: 'x', type: 'text' }] }],
    })
    expect(() => kernelWith([owner, fixed])).not.toThrow()
  })

  it('freezes the adapter lists', () => {
    expect(Object.isFrozen(kernelWith([]).adapters.contentExtractor)).toBe(true)
  })
})

describe('November review changes (#665)', () => {
  describe('locales', () => {
    const registered = [
      { code: 'en', label: 'English' },
      { code: 'fr', label: 'Français' },
      { code: 'ar', label: 'العربية', rtl: true },
    ]
    const withLocales = (env: Record<string, string> = {}) =>
      createKernel({ plugins: [corePlugin, sitePlugin], locales: registered, env })

    it('reads PT_LOCALES in lower case, without repeats', () => {
      expect(readLocales({ PT_LOCALES: ' FR , ar,fr ' })).toEqual(['fr', 'ar'])
      expect(readLocales({})).toEqual([])
    })

    it('uses only English when PT_LOCALES is unset', () => {
      const kernel = withLocales()
      expect(kernel.locales.map((l) => l.code)).toEqual(['en'])
      expect(kernel.defaultLocale).toBe('en')
    })

    it('keeps the default locale on and first, whatever PT_LOCALES says', () => {
      expect(withLocales({ PT_LOCALES: 'ar,fr' }).locales.map((l) => l.code)).toEqual([
        'en',
        'fr',
        'ar',
      ])
    })

    it('stops on a locale that is not registered and lists the registered ones', () => {
      expect(() => withLocales({ PT_LOCALES: 'en,sw' })).toThrow(
        /PT_LOCALES names locales that are not registered: "sw"\. Registered locales: "en", "fr", "ar"/,
      )
    })

    it('stops when the default locale is not registered', () => {
      expect(() =>
        createKernel({
          plugins: [corePlugin, sitePlugin],
          locales: registered,
          defaultLocale: 'pt',
        }),
      ).toThrow('The default locale "pt" is not registered')
    })

    it('names the locales in the summary line', () => {
      expect(withLocales({ PT_LOCALES: 'fr' }).summary()).toContain('locales=en,fr')
    })
  })

  describe('taking over core fields', () => {
    const claims: CollectionConfig = {
      slug: 'claims',
      fields: [
        { name: 'title', type: 'text' },
        {
          type: 'row',
          fields: [
            {
              name: 'verification',
              type: 'group',
              fields: [
                { name: 'verdict', type: 'text', access: { read: () => true } },
                { name: 'rationale', type: 'textarea' },
              ],
            },
          ],
        },
      ],
    }
    const config = (): Config => ({ ...baseConfig(), collections: [claims] })
    const checker: PluginManifest = {
      slug: 'checker',
      version: '0.0.0',
      order: 50,
      takesOver: [{ collection: 'claims', fields: ['verification.verdict'] }],
    }
    const verdictIn = (c: Config): Field => {
      const row = collection(c, 'claims').fields.find((f) => f.type === 'row')
      const group = fieldNamed(row && 'fields' in row ? row.fields : [], 'verification')
      return fieldNamed('fields' in group ? group.fields : [], 'verdict')
    }
    const superAdmin = { id: 'u1', roles: ['super-admin'] }

    it('makes the field read-only to everyone but a super-admin while enabled', () => {
      const verdict = verdictIn(applyManifest(config(), checker, true))
      expect(verdict).toMatchObject({ admin: { readOnly: true } })
      const access = 'access' in verdict ? verdict.access : undefined
      expect(access?.update?.({ req: { user: { roles: ['reviewer'] } } } as never)).toBe(false)
      expect(access?.update?.({ req: { user: superAdmin } } as never)).toBe(true)
      // The field's other rules stay.
      expect(access?.read).toBeTypeOf('function')
    })

    it('leaves other fields and a disabled plugin alone', () => {
      const on = applyManifest(config(), checker, true)
      const row = collection(on, 'claims').fields.find((f) => f.type === 'row')
      const group = fieldNamed(row && 'fields' in row ? row.fields : [], 'verification')
      expect(fieldNamed('fields' in group ? group.fields : [], 'rationale')).not.toHaveProperty(
        'admin',
      )
      expect(verdictIn(applyManifest(config(), checker, false))).not.toHaveProperty('admin')
    })

    it("logs a super-admin's change by field name, without the values", () => {
      const verdict = verdictIn(applyManifest(config(), checker, true))
      const hook = 'hooks' in verdict ? verdict.hooks?.beforeChange?.[0] : undefined
      const run = (user: unknown) => {
        const warn = vi.fn()
        hook?.({
          req: { user, payload: { logger: { warn } } },
          value: 'new-value',
          previousValue: 'old-value',
          collection: { slug: 'claims' },
          originalDoc: { id: 'c1' },
        } as never)
        return warn
      }
      const warn = run(superAdmin)
      expect(warn).toHaveBeenCalledOnce()
      const entry = JSON.stringify(warn.mock.calls[0])
      expect(entry).toContain('verification.verdict')
      expect(entry).not.toContain('value')
      expect(run({ roles: ['editor'] })).not.toHaveBeenCalled()
    })

    it('stops on a path that does not exist, even while the plugin is disabled', () => {
      const typo = { ...checker, takesOver: [{ collection: 'claims', fields: ['verification.x'] }] }
      for (const enabled of [true, false]) {
        expect(() => applyManifest(config(), typo, enabled)).toThrow(
          'takes over "claims.verification.x", which does not exist',
        )
      }
    })

    it('stops when the record type is not defined yet', () => {
      expect(() => applyManifest(baseConfig(), checker, true)).toThrow(
        'takes over fields on "claims", which no earlier plugin defines',
      )
    })

    const owner = definePromiseTrackerPlugin({
      slug: 'owner',
      version: '0.0.0',
      order: 20,
      dependsOn: ['core'],
      collections: [claims],
    })
    const taker = (slug: string, dependsOn: string[] = ['core', 'owner']) =>
      plugin({
        slug,
        dependsOn,
        takesOver: [{ collection: 'claims', fields: ['verification.verdict'] }],
      })

    it("stops when the record type's owner is not in dependsOn", () => {
      expect(() => kernelWith([owner, taker('check', ['core'])])).toThrow(
        'Plugin "check" takes over fields on "claims", which plugin "owner" owns. Add "owner" to its dependsOn.',
      )
    })

    it('stops when two enabled plugins take over one field', () => {
      const both = [owner, taker('check'), taker('superdesk')]
      expect(() => kernelWith(both, enabling('owner', 'check', 'superdesk'))).toThrow(
        'Plugins "check" and "superdesk" both take over "claims.verification.verdict"',
      )
      expect(() => kernelWith(both, enabling('owner', 'check'))).not.toThrow()
    })
  })

  describe('plugin settings', () => {
    const fake = (doc: unknown = { check: { apiKey: 'k' } }) => {
      const findGlobal = vi.fn(async () => doc)
      const payload = { config: { globals: [{ slug: 'settings' }] }, findGlobal }
      return { payload: payload as unknown as Payload, findGlobal }
    }

    it('are read once and reused', async () => {
      const { payload, findGlobal } = fake()
      await readSettings(payload, 1_000)
      await expect(readSettings(payload, 2_000)).resolves.toEqual({ check: { apiKey: 'k' } })
      expect(findGlobal).toHaveBeenCalledOnce()
    })

    it('are read again after a save in this process', async () => {
      const { payload, findGlobal } = fake()
      await readSettings(payload, 1_000)
      forgetSettings(payload)
      await readSettings(payload, 1_001)
      expect(findGlobal).toHaveBeenCalledTimes(2)
    })

    it('are read again once they are old, for a save made in another process', async () => {
      const { payload, findGlobal } = fake()
      await readSettings(payload, 1_000)
      await readSettings(payload, 1_000 + SETTINGS_TTL_MS)
      expect(findGlobal).toHaveBeenCalledTimes(2)
    })

    it('do not keep a failed read', async () => {
      const findGlobal = vi
        .fn<() => Promise<unknown>>()
        .mockRejectedValueOnce(new Error('database down'))
        .mockResolvedValueOnce({ check: {} })
      const payload = { config: { globals: [{ slug: 'settings' }] }, findGlobal }
      await expect(readSettings(payload as unknown as Payload, 1_000)).rejects.toThrow('down')
      await expect(readSettings(payload as unknown as Payload, 1_001)).resolves.toEqual({
        check: {},
      })
    })

    it('are empty, with no read, when no plugin declares settings', async () => {
      const findGlobal = vi.fn()
      const payload = { config: { globals: [] }, findGlobal }
      await expect(readSettings(payload as unknown as Payload)).resolves.toEqual({})
      expect(findGlobal).not.toHaveBeenCalled()
    })

    it('are forgotten when the settings global is saved', () => {
      const on = applyManifest(baseConfig(), fullManifest, true)
      const settings = on.globals?.find((g) => g.slug === 'settings')
      expect(settings?.hooks?.afterChange).toHaveLength(1)
    })

    it("reach an adapter's context as that plugin's own group", async () => {
      const { payload, findGlobal } = fake({ check: { apiKey: 'k' }, ai: { apiKey: 'other' } })
      Object.assign(payload, { logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } })
      const kernel = kernelWith([])
      await expect(kernel.context(payload, 'check')).resolves.toMatchObject({
        settings: { apiKey: 'k' },
      })
      await kernel.context(payload, 'check')
      expect(findGlobal).toHaveBeenCalledOnce()
    })
  })

  describe('port shapes', () => {
    it('carries a misleading verdict, a report link and a withdrawn report', () => {
      const update: VerdictUpdate = {
        externalId: 'item-1',
        verdict: 'misleading',
        reportUrl: 'https://example.org/report',
        withdrawn: true,
      }
      expect(update.verdict).toBe('misleading')
    })

    it('returns the tokens an AI call used', async () => {
      const result: LLMResult = { output: {}, usage: { inputTokens: 10, outputTokens: 4 } }
      const provider: LLMProvider = { ...llm('stub'), generate: async () => result }
      const ctx = await kernelWith([]).context(
        { config: { globals: [] }, logger: {} } as unknown as Payload,
        'ai',
      )
      const request = { model: 'm', system: '', prompt: '', outputSchema: {} }
      await expect(provider.generate(request, ctx)).resolves.toEqual(result)
    })

    it('lets an importer read rows, and nothing else', async () => {
      const importer: StructuredImporter = {
        id: 'csv',
        accepts: ['text/csv'],
        health: healthy,
        inspect: async () => ({ headings: ['name'], sampleRows: [['Nairobi']] }),
        rows: async function* () {
          yield { row: 1, values: ['Nairobi'] }
          yield { row: 2, values: ['Mombasa'] }
        },
      }
      const content = { filename: 'a.csv', mimeType: 'text/csv', data: new Uint8Array() }
      const ctx = await kernelWith([]).context(
        { config: { globals: [] }, logger: {} } as unknown as Payload,
        'core',
      )
      const read: ImportRow[] = []
      for await (const row of importer.rows(content, ctx)) read.push(row)
      expect(read.map((r) => r.row)).toEqual([1, 2])
      expect(importer).not.toHaveProperty('import')
    })
  })
})

describe('a rule for the whole config', () => {
  it('runs after every plugin, whatever its place in the list', () => {
    const rule = defineFinalPlugin('rule', (config) => config)
    const orders = kernelWith([plugin({ slug: 'late', order: 9_000 })]).payloadPlugins.map(
      (p) => (p as { order?: number }).order ?? 0,
    )
    expect((rule as { order?: number }).order).toBeGreaterThan(Math.max(...orders))
  })
})
