import { createAnthropic } from '@ai-sdk/anthropic'
import { createCerebras } from '@ai-sdk/cerebras'
import { createCohere } from '@ai-sdk/cohere'
import { createDeepInfra } from '@ai-sdk/deepinfra'
import { createDeepSeek } from '@ai-sdk/deepseek'
import { createFireworks } from '@ai-sdk/fireworks'
import { createGoogle } from '@ai-sdk/google'
import { createGroq } from '@ai-sdk/groq'
import { createMistral } from '@ai-sdk/mistral'
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { createPerplexity } from '@ai-sdk/perplexity'
import { createTogetherAI } from '@ai-sdk/togetherai'
import { createXai } from '@ai-sdk/xai'
import type {
  AdapterContext,
  HealthReport,
  LLMProvider,
  LLMRequest,
  LLMResult,
} from '@promisetracker/kernel'
import { ConfigurationError, ExternalServiceError } from '@promisetracker/kernel'
import { SECRET_MASK } from '@promisetracker/plugin-core'
import type { LanguageModel } from 'ai'
import { APICallError, generateText, jsonSchema, Output } from 'ai'

/**
 * One LLM provider adapter per AI vendor (section 6.1), from v2's
 * `providerCatalog.ts` and `providerRegistry.ts`. PT_LLM_MODEL picks one, as
 * `provider:model`. The vendor's key, and an address for Ollama or a proxy,
 * are in the plugin's encrypted settings, never in environment variables.
 */

type ClientOptions = { apiKey?: string; baseURL?: string }

type Vendor = {
  id: string
  label: string
  /** Ollama runs on the deployment's own machines and needs no key. */
  requiresApiKey: boolean
  model: (options: ClientOptions, model: string) => LanguageModel
}

const OLLAMA_URL = 'http://127.0.0.1:11434/v1'

/** Drops trailing slashes. A loop, not a regular expression, which a long run of slashes would slow. */
const trimSlashes = (value: string): string => {
  let end = value.length
  while (end > 0 && value[end - 1] === '/') end--
  return value.slice(0, end)
}

/** Ollama's OpenAI-compatible API is under /v1. An address without it gets it. */
export function ollamaUrl(given: string | undefined): string {
  if (!given) return OLLAMA_URL
  try {
    const url = new URL(given)
    const path = trimSlashes(url.pathname)
    const v1 = path.indexOf('/v1')
    url.pathname = v1 >= 0 ? path.slice(0, v1 + 3) : `${path}/v1`
    return trimSlashes(url.toString())
  } catch {
    return trimSlashes(given)
  }
}

/** The vendors v2 supported, in v2's order. */
export const VENDORS: readonly Vendor[] = [
  { id: 'google', label: 'Google', requiresApiKey: true, model: (o, m) => createGoogle(o)(m) },
  { id: 'xai', label: 'Grok (xAI)', requiresApiKey: true, model: (o, m) => createXai(o)(m) },
  { id: 'openai', label: 'OpenAI', requiresApiKey: true, model: (o, m) => createOpenAI(o)(m) },
  {
    id: 'anthropic',
    label: 'Anthropic',
    requiresApiKey: true,
    model: (o, m) => createAnthropic(o)(m),
  },
  { id: 'mistral', label: 'Mistral', requiresApiKey: true, model: (o, m) => createMistral(o)(m) },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    requiresApiKey: true,
    model: (o, m) => createDeepSeek(o)(m),
  },
  {
    id: 'cerebras',
    label: 'Cerebras',
    requiresApiKey: true,
    model: (o, m) => createCerebras(o)(m),
  },
  { id: 'groq', label: 'Groq', requiresApiKey: true, model: (o, m) => createGroq(o)(m) },
  {
    id: 'togetherai',
    label: 'Together AI',
    requiresApiKey: true,
    model: (o, m) => createTogetherAI(o)(m),
  },
  { id: 'cohere', label: 'Cohere', requiresApiKey: true, model: (o, m) => createCohere(o)(m) },
  {
    id: 'fireworks',
    label: 'Fireworks',
    requiresApiKey: true,
    model: (o, m) => createFireworks(o)(m),
  },
  {
    id: 'deepinfra',
    label: 'DeepInfra',
    requiresApiKey: true,
    model: (o, m) => createDeepInfra(o)(m),
  },
  {
    id: 'perplexity',
    label: 'Perplexity',
    requiresApiKey: true,
    model: (o, m) => createPerplexity(o)(m),
  },
  {
    id: 'ollama',
    label: 'Ollama',
    requiresApiKey: false,
    model: ({ apiKey, baseURL }, m) =>
      createOpenAICompatible({
        name: 'ollama',
        baseURL: ollamaUrl(baseURL),
        ...(apiKey ? { apiKey } : {}),
      })(m),
  },
]

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined

/** The key and address from the plugin's settings. */
export function credentials(vendor: Vendor, settings: AdapterContext['settings']): ClientOptions {
  const apiKey = text(settings.apiKey)
  const baseURL = text(settings.baseUrl)
  // Settings read as a signed-in user come back masked. The kernel reads them
  // as the system, so this means a code path passed a person's request.
  if (apiKey === SECRET_MASK || baseURL === SECRET_MASK) {
    throw new ConfigurationError(
      'The AI settings were read as a person, so they are masked. Read them as the system.',
    )
  }
  if (vendor.requiresApiKey && !apiKey) {
    throw new ConfigurationError(
      `The ${vendor.label} key is not set. A super-admin sets it in Administration > Settings > AI.`,
    )
  }
  return { ...(apiKey ? { apiKey } : {}), ...(baseURL ? { baseURL } : {}) }
}

/** The service name for errors, logs and the circuit breaker: one per vendor. */
export const serviceOf = (vendorId: string) => `ai:${vendorId}`

const CREDIT =
  /insufficient[_ ]quota|credit balance|out of credits?|billing|payment required|quota exceeded|exceeded your current quota|resource[_ ]exhausted/i

const bodyOf = (error: APICallError): string =>
  `${error.message} ${typeof error.responseBody === 'string' ? error.responseBody : ''}`

/**
 * Whether the vendor refused because the account has no credit left. Vendors
 * say so differently: HTTP 402, or a 429 or 400 whose body names the quota or
 * the balance. Only a person topping up the account fixes it, so it is not
 * retried like an ordinary rate limit.
 */
export function isCreditExhausted(error: unknown): boolean {
  if (!APICallError.isInstance(error)) return false
  if (error.statusCode === 402) return true
  const status = error.statusCode ?? 0
  return (status === 429 || status === 400 || status === 403) && CREDIT.test(bodyOf(error))
}

/** A vendor's error as one of ours, so the retry rules in section 9.7 apply. */
export function toServiceError(vendorId: string, error: unknown): ExternalServiceError {
  const service = serviceOf(vendorId)
  if (error instanceof ExternalServiceError) return error
  if (isCreditExhausted(error)) {
    return new ExternalServiceError(
      `${service} has no credit left. Top up the account, or choose another model.`,
      { service, failure: 'unauthorized', code: 'external.credit-exhausted', cause: error },
    )
  }
  if (APICallError.isInstance(error) && error.statusCode !== undefined) {
    const headers = new Headers(error.responseHeaders ?? {})
    return ExternalServiceError.fromResponse(
      service,
      { status: error.statusCode, headers },
      { cause: error },
    )
  }
  return ExternalServiceError.fromCause(service, error)
}

/** A health check is cheap or it is down. */
export const HEALTH_TIMEOUT_MS = 10_000

/**
 * How long a health check's answer is reused. Each check is a real request
 * that the vendor bills, and an uptime monitor may ask every few seconds.
 */
export const HEALTH_TTL_MS = 60_000

/** The model PT_LLM_MODEL chose, which only the app knows. Set by `configureAi`. */
let selected: { vendor: string; model: string } | null = null

/** Records the model the kernel chose, for health checks and the extraction job. */
export function selectModel(choice: { vendor: string; model: string } | null): void {
  selected = choice
  healthCache.clear()
}

export const selectedModel = () => selected

const healthCache = new Map<string, { at: number; report: HealthReport }>()

const TEST_SCHEMA = {
  type: 'object',
  properties: { ok: { type: 'boolean' } },
  required: ['ok'],
  additionalProperties: false,
} as const

function vendorAdapter(vendor: Vendor): LLMProvider {
  const generate = async (request: LLMRequest, ctx: AdapterContext): Promise<LLMResult> => {
    const options = credentials(vendor, ctx.settings)
    try {
      const result = await generateText({
        model: vendor.model(options, request.model),
        instructions: request.system,
        prompt: request.prompt,
        output: Output.object({ schema: jsonSchema(request.outputSchema as never) }),
        // The pipeline retries, with the waits in section 9.7 and a circuit breaker.
        maxRetries: 0,
        abortSignal: ctx.signal,
      })
      return {
        output: result.output,
        usage: {
          inputTokens: result.totalUsage.inputTokens ?? 0,
          outputTokens: result.totalUsage.outputTokens ?? 0,
        },
      }
    } catch (error) {
      throw toServiceError(vendor.id, error)
    }
  }

  /**
   * A small test request (section 6.1). It reports exhausted credit, a
   * rejected key and an unreachable vendor, so the health check shows the
   * plugin degraded before a document fails.
   */
  const health = async (ctx: AdapterContext): Promise<HealthReport> => {
    if (selected?.vendor !== vendor.id) return { healthy: true, detail: 'not selected' }
    const { model } = selected
    const key = `${vendor.id}:${model}:${String(ctx.settings.apiKey ?? '')}`
    const cached = healthCache.get(key)
    if (cached && Date.now() - cached.at < HEALTH_TTL_MS) return cached.report
    let report: HealthReport
    try {
      await generate(
        {
          model,
          system: 'You answer health checks.',
          prompt: 'Reply with {"ok": true}.',
          outputSchema: TEST_SCHEMA,
        },
        { ...ctx, signal: AbortSignal.any([ctx.signal, AbortSignal.timeout(HEALTH_TIMEOUT_MS)]) },
      )
      report = { healthy: true }
    } catch (error) {
      // The reason, never the key or the vendor's address (section 13.7).
      const code =
        error instanceof ExternalServiceError || error instanceof ConfigurationError
          ? error.code
          : 'external.unavailable'
      report = { healthy: false, detail: code }
    }
    healthCache.set(key, { at: Date.now(), report })
    return report
  }

  return Object.freeze({
    id: vendor.id,
    // Any model the vendor serves: PT_LLM_MODEL names it.
    models: [],
    generate,
    health,
  })
}

export const llmProviders: readonly LLMProvider[] = VENDORS.map(vendorAdapter)
