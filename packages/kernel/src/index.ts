/**
 * The kernel: ports, the plugin helper and the start-up checks (section 4 of
 * the system specification).
 */

export type { CircuitBreakerOptions, CircuitState } from './circuit'
export { CIRCUIT_DEFAULTS, CircuitBreaker, circuitBreakerFor } from './circuit'
export type { Env, KernelEnv } from './env'
export { DEFAULT_PLUGINS, readEnabledPlugins, readKernelEnv, readLocales } from './env'
export type {
  Audience,
  ErrorOptions,
  ExternalFailure,
  ExternalServiceErrorOptions,
  RecordIds,
} from './errors'
export {
  ConfigurationError,
  ExternalServiceError,
  ExtractionError,
  isDeveloperError,
  OwnershipError,
  PortResolutionError,
  PromiseTrackerError,
  parseRetryAfter,
  ValidationError,
} from './errors'
export type { Kernel, KernelOptions, LocaleSpec, ResolvedAdapters } from './kernel'
export { createKernel } from './kernel'
export type { LogFields, SourceLog } from './log'
export { createLog, REDACTED, redact, redactText } from './log'
export type { HttpMethod, PluginManifest, PluginRoute, PromiseTrackerPlugin } from './plugin'
export {
  applyManifest,
  defineFinalPlugin,
  definePromiseTrackerPlugin,
  isSuperAdmin,
} from './plugin'
export * from './ports'
export type { RetryDecision, RetryOptions } from './retry'
export { backoffMs, RETRY_LIMITS, retryDecision, TIMEOUTS, withRetry } from './retry'
export { pluginRoute } from './routes'
export { forgetSettings, readSettings, SETTINGS_GLOBAL, SETTINGS_TTL_MS } from './settings'
