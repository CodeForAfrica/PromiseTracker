/** Environment variables, as process.env or a plain object in tests. */
export type Env = Readonly<Record<string, string | undefined>>

/** The three variables that select the set-up (section 4.3). */
export interface KernelEnv {
  /** Enabled plugin slugs. `core` and `site` when PT_PLUGINS is unset. */
  readonly plugins: readonly string[]
  /** The verification adapter to use, when more than one is available. */
  readonly verification: string | undefined
  /** `provider:model`, for example `google:gemini-2.5-pro`. */
  readonly llmModel: string | undefined
}

export const DEFAULT_PLUGINS = ['core', 'site'] as const

const clean = (value: string | undefined): string | undefined => value?.trim() || undefined

export function readEnabledPlugins(env: Env = process.env): string[] {
  const raw = clean(env.PT_PLUGINS)
  if (!raw) return [...DEFAULT_PLUGINS]
  const plugins = raw
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
  return [...new Set(plugins)]
}

/** Reads the set-up once. The kernel keeps the result for the life of the process. */
export function readKernelEnv(env: Env = process.env): KernelEnv {
  return Object.freeze({
    plugins: Object.freeze(readEnabledPlugins(env)),
    verification: clean(env.PT_VERIFICATION),
    llmModel: clean(env.PT_LLM_MODEL),
  })
}
