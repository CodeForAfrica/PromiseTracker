/**
 * The kernel: ports, the plugin loader and the start-up checks (section 4 of
 * the system specification). This first version only reads which plugins are
 * enabled. The ports and the loader come with V1-04.
 */

export const DEFAULT_PLUGINS = ['core', 'site'] as const

export function readEnabledPlugins(env: NodeJS.ProcessEnv = process.env): string[] {
  const raw = env.PT_PLUGINS?.trim()
  if (!raw) return [...DEFAULT_PLUGINS]
  const plugins = raw
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
  return [...new Set(plugins)]
}
