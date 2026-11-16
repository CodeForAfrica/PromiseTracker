/** Environment variables, as process.env or a plain object in tests. */
export type Env = Readonly<Record<string, string | undefined>>

/** The four variables that select the set-up (section 4.3). */
export interface KernelEnv {
  /** Enabled plugin slugs. `core` and `site` when PT_PLUGINS is unset. */
  readonly plugins: readonly string[]
  /** The verification adapter to use, when more than one is available. */
  readonly verification: string | undefined
  /** `provider:model`, for example `google:gemini-2.5-pro`. */
  readonly llmModel: string | undefined
  /** Locale codes from PT_LOCALES, as written. The kernel checks them (section 7.1). */
  readonly locales: readonly string[]
}

export const DEFAULT_PLUGINS = ['core', 'site'] as const

const clean = (value: string | undefined): string | undefined => value?.trim() || undefined

const readList = (raw: string | undefined): string[] | undefined => {
  const value = clean(raw)
  if (!value) return undefined
  const items = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  return [...new Set(items)]
}

export function readEnabledPlugins(env: Env = process.env): string[] {
  return readList(env.PT_PLUGINS) ?? [...DEFAULT_PLUGINS]
}

/** The locale codes in PT_LOCALES, in lower case. Empty when it is unset. */
export function readLocales(env: Env = process.env): string[] {
  return [...new Set((readList(env.PT_LOCALES) ?? []).map((code) => code.toLowerCase()))]
}

/** Reads the set-up once. The kernel keeps the result for the life of the process. */
export function readKernelEnv(env: Env = process.env): KernelEnv {
  return Object.freeze({
    plugins: Object.freeze(readEnabledPlugins(env)),
    verification: clean(env.PT_VERIFICATION),
    llmModel: clean(env.PT_LLM_MODEL),
    locales: Object.freeze(readLocales(env)),
  })
}
