import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { GENERATED_PROVIDER_MODEL_IDS } from "./providerModelIds.generated";

const require = createRequire(import.meta.url);

export const AI_PROVIDER_IDS = [
  "google",
  "xai",
  "openai",
  "anthropic",
  "mistral",
  "deepseek",
  "cerebras",
  "groq",
  "togetherai",
  "cohere",
  "fireworks",
  "deepinfra",
  "perplexity",
  "ollama",
] as const;

export type AIProviderId = (typeof AI_PROVIDER_IDS)[number];
export type ProviderModelId = `${AIProviderId}:${string}`;

type ModelCapabilities = {
  supportsStructuredOutput?: boolean;
  supportsToolCalling?: boolean;
};

type ProviderModelTypeSource = {
  packageName: string;
  typeName: string;
};

export type CuratedModel = ModelCapabilities & {
  id: string;
  label: string;
};

export type ProviderCatalogItem = ModelCapabilities & {
  id: AIProviderId;
  label: string;
  envApiKey?: string;
  envBaseURL?: string;
  requiresApiKey: boolean;
  curatedModels: CuratedModel[];
};

export type AIProviderCredentialLike = {
  provider?: string | null;
  apiKey?: string | null;
  baseURL?: string | null;
};

export type AISettingsLike = {
  providerCredentials?: AIProviderCredentialLike[] | null;
  apiKey?: string | null;
  modelProvider?: string | null;
  modelPreset?: string | null;
  customModelId?: string | null;
  model?: string | null;
};

export const MODEL_ID_PATTERN = /^[a-z0-9-]+:\S+$/i;

const trimToUndefined = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const supportsExtractionCapabilities = ({
  supportsStructuredOutput,
  supportsToolCalling,
}: ModelCapabilities): boolean =>
  (supportsStructuredOutput ?? true) && (supportsToolCalling ?? true);

const PROVIDER_MODEL_TYPE_SOURCES: Partial<
  Record<AIProviderId, ProviderModelTypeSource>
> = {
  google: {
    packageName: "@ai-sdk/google",
    typeName: "GoogleGenerativeAIModelId",
  },
  xai: {
    packageName: "@ai-sdk/xai",
    typeName: "XaiChatModelId",
  },
  openai: {
    packageName: "@ai-sdk/openai",
    typeName: "OpenAIChatModelId",
  },
  anthropic: {
    packageName: "@ai-sdk/anthropic",
    typeName: "AnthropicMessagesModelId",
  },
  mistral: {
    packageName: "@ai-sdk/mistral",
    typeName: "MistralChatModelId",
  },
  deepseek: {
    packageName: "@ai-sdk/deepseek",
    typeName: "DeepSeekChatModelId",
  },
  cerebras: {
    packageName: "@ai-sdk/cerebras",
    typeName: "CerebrasChatModelId",
  },
  groq: {
    packageName: "@ai-sdk/groq",
    typeName: "GroqChatModelId",
  },
  togetherai: {
    packageName: "@ai-sdk/togetherai",
    typeName: "TogetherAIChatModelId",
  },
  cohere: {
    packageName: "@ai-sdk/cohere",
    typeName: "CohereChatModelId",
  },
  fireworks: {
    packageName: "@ai-sdk/fireworks",
    typeName: "FireworksChatModelId",
  },
  deepinfra: {
    packageName: "@ai-sdk/deepinfra",
    typeName: "DeepInfraChatModelId",
  },
  perplexity: {
    packageName: "@ai-sdk/perplexity",
    typeName: "PerplexityLanguageModelId",
  },
};

const providerModelIdsCache = new Map<AIProviderId, string[]>();

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const readTypeUnionLiterals = ({
  packageName,
  typeName,
}: ProviderModelTypeSource): string[] => {
  const packageJsonPath = require.resolve(`${packageName}/package.json`);
  const declarationPath = path.join(path.dirname(packageJsonPath), "dist/index.d.ts");
  const source = fs.readFileSync(declarationPath, "utf8");
  const typeRegex = new RegExp(
    `type\\s+${escapeRegExp(typeName)}\\s*=\\s*([\\s\\S]*?);`,
  );
  const match = source.match(typeRegex);

  if (!match) {
    return [];
  }

  const literals = Array.from(match[1].matchAll(/'([^']+)'/g), (part) => part[1]);
  return [...new Set(literals)];
};

const getFallbackProviderModelIds = (providerId: AIProviderId): string[] => {
  const fallback = GENERATED_PROVIDER_MODEL_IDS[providerId];
  return fallback ? [...fallback] : [];
};

const loadProviderModelIds = (providerId: AIProviderId): string[] => {
  const cached = providerModelIdsCache.get(providerId);
  if (cached) {
    return cached;
  }

  const source = PROVIDER_MODEL_TYPE_SOURCES[providerId];

  if (!source) {
    const fallback = getFallbackProviderModelIds(providerId);
    providerModelIdsCache.set(providerId, fallback);
    return fallback;
  }

  try {
    const ids = readTypeUnionLiterals(source);
    const resolvedIds = ids.length > 0 ? ids : getFallbackProviderModelIds(providerId);
    providerModelIdsCache.set(providerId, resolvedIds);
    return resolvedIds;
  } catch {
    const fallback = getFallbackProviderModelIds(providerId);
    providerModelIdsCache.set(providerId, fallback);
    return fallback;
  }
};

const AI_PROVIDER_BASE_CATALOG = [
  {
    id: "google",
    label: "Google",
    envApiKey: "GOOGLE_GENERATIVE_AI_API_KEY",
    requiresApiKey: true,
  },
  {
    id: "xai",
    label: "Grok (xAI)",
    envApiKey: "XAI_API_KEY",
    requiresApiKey: true,
  },
  {
    id: "openai",
    label: "OpenAI",
    envApiKey: "OPENAI_API_KEY",
    requiresApiKey: true,
  },
  {
    id: "anthropic",
    label: "Anthropic",
    envApiKey: "ANTHROPIC_API_KEY",
    requiresApiKey: true,
  },
  {
    id: "mistral",
    label: "Mistral",
    envApiKey: "MISTRAL_API_KEY",
    requiresApiKey: true,
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    envApiKey: "DEEPSEEK_API_KEY",
    requiresApiKey: true,
  },
  {
    id: "cerebras",
    label: "Cerebras",
    envApiKey: "CEREBRAS_API_KEY",
    requiresApiKey: true,
  },
  {
    id: "groq",
    label: "Groq",
    envApiKey: "GROQ_API_KEY",
    requiresApiKey: true,
  },
  {
    id: "togetherai",
    label: "Together AI",
    envApiKey: "TOGETHER_API_KEY",
    requiresApiKey: true,
  },
  {
    id: "cohere",
    label: "Cohere",
    envApiKey: "COHERE_API_KEY",
    requiresApiKey: true,
  },
  {
    id: "fireworks",
    label: "Fireworks",
    envApiKey: "FIREWORKS_API_KEY",
    requiresApiKey: true,
  },
  {
    id: "deepinfra",
    label: "DeepInfra",
    envApiKey: "DEEPINFRA_API_KEY",
    requiresApiKey: true,
  },
  {
    id: "perplexity",
    label: "Perplexity",
    envApiKey: "PERPLEXITY_API_KEY",
    requiresApiKey: true,
  },
  {
    id: "ollama",
    label: "Ollama",
    envApiKey: "OLLAMA_API_KEY",
    envBaseURL: "OLLAMA_BASE_URL",
    requiresApiKey: false,
  },
] satisfies Omit<ProviderCatalogItem, "curatedModels">[];

export const AI_PROVIDER_CATALOG: ProviderCatalogItem[] = AI_PROVIDER_BASE_CATALOG.map(
  (provider) => ({
    ...provider,
    curatedModels: loadProviderModelIds(provider.id).map((modelId) => ({
      id: modelId,
      label: modelId,
    })),
  }),
);

export const DEFAULT_MODEL_PRESET: ProviderModelId = "google:gemini-2.5-pro";

export const getProviderCatalogItem = (providerId: string) =>
  AI_PROVIDER_CATALOG.find((provider) => provider.id === providerId);

const toProviderIdSet = (
  providerIds?: readonly AIProviderId[] | Set<AIProviderId>,
) => (providerIds ? new Set(providerIds) : undefined);

export const getProviderOptions = (providerIds?: readonly AIProviderId[]) => {
  const allowedProviders = toProviderIdSet(providerIds);

  return AI_PROVIDER_CATALOG.filter((provider) =>
    allowedProviders ? allowedProviders.has(provider.id) : true,
  ).map((provider) => ({
    value: provider.id,
    label: provider.label,
  }));
};

export const AI_PROVIDER_OPTIONS = getProviderOptions();

export const getModelPresetOptions = (options?: {
  providerIds?: readonly AIProviderId[] | Set<AIProviderId>;
  requireExtractionCapabilities?: boolean;
  includeProviderInLabel?: boolean;
}) => {
  const allowedProviders = toProviderIdSet(options?.providerIds);
  const requireExtractionCapabilities =
    options?.requireExtractionCapabilities ?? false;
  const includeProviderInLabel = options?.includeProviderInLabel ?? true;

  return AI_PROVIDER_CATALOG.flatMap((provider) => {
    if (allowedProviders && !allowedProviders.has(provider.id)) {
      return [];
    }

    if (
      requireExtractionCapabilities &&
      !supportsExtractionCapabilities(provider)
    ) {
      return [];
    }

    return provider.curatedModels
      .filter((model) =>
        requireExtractionCapabilities
          ? supportsExtractionCapabilities(model)
          : true,
      )
      .map((model) => ({
        value: `${provider.id}:${model.id}`,
        label: includeProviderInLabel
          ? `[${provider.label}] ${model.label}`
          : model.label,
      }));
  });
};

export const MODEL_PRESET_OPTIONS = getModelPresetOptions({
  includeProviderInLabel: true,
});

export const getCuratedModelForProvider = (
  providerId: AIProviderId,
  modelId: string,
) =>
  getProviderCatalogItem(providerId)?.curatedModels.find(
    (model) => model.id === modelId,
  );

export const isProviderModelId = (value: string): value is ProviderModelId => {
  if (!MODEL_ID_PATTERN.test(value)) {
    return false;
  }

  const separatorIndex = value.indexOf(":");
  if (separatorIndex < 1) {
    return false;
  }

  const providerId = value.slice(0, separatorIndex).toLowerCase();
  const modelId = value.slice(separatorIndex + 1).trim();
  return Boolean(modelId) && Boolean(getProviderCatalogItem(providerId));
};

export const isProviderIdSupportedForExtraction = (providerId: string) => {
  const provider = getProviderCatalogItem(providerId);
  return Boolean(provider && supportsExtractionCapabilities(provider));
};

export const isProviderModelSupportedForExtraction = (
  modelId: ProviderModelId | string,
) => {
  if (!isProviderModelId(modelId)) {
    return false;
  }

  const { providerId, modelId: providerModelId } = splitProviderModelId(modelId);
  const provider = getProviderCatalogItem(providerId);

  if (!provider || !supportsExtractionCapabilities(provider)) {
    return false;
  }

  const curatedModel = getCuratedModelForProvider(providerId, providerModelId);
  if (!curatedModel) {
    // For custom models, allow the provider's declared capabilities to decide.
    return true;
  }

  return supportsExtractionCapabilities(curatedModel);
};

export const splitProviderModelId = (
  value: ProviderModelId | string,
): { providerId: AIProviderId; modelId: string } => {
  const separatorIndex = value.indexOf(":");
  const providerId = value.slice(0, separatorIndex).toLowerCase();
  const modelId = value.slice(separatorIndex + 1).trim();
  const provider = getProviderCatalogItem(providerId);

  if (!provider || !modelId) {
    throw new Error(
      `Invalid model id "${value}". Expected format "provider:model".`,
    );
  }

  return {
    providerId: provider.id,
    modelId,
  };
};

const getSettingsCredentialsByProvider = (ai: AISettingsLike) => {
  const credentials = ai.providerCredentials ?? [];
  const map = new Map<
    AIProviderId,
    {
      apiKey?: string;
      baseURL?: string;
    }
  >();

  for (const entry of credentials) {
    const providerId = trimToUndefined(entry?.provider)?.toLowerCase();
    if (!providerId) {
      continue;
    }

    const provider = getProviderCatalogItem(providerId);
    if (!provider) {
      continue;
    }

    map.set(provider.id, {
      apiKey: trimToUndefined(entry?.apiKey),
      baseURL: trimToUndefined(entry?.baseURL),
    });
  }

  return map;
};

export const getConfiguredProviderIds = (
  ai: AISettingsLike,
  options?: {
    includeEnvFallback?: boolean;
    includeLegacyGoogleApiKey?: boolean;
  },
) => {
  const includeEnvFallback = options?.includeEnvFallback ?? true;
  const includeLegacyGoogleApiKey = options?.includeLegacyGoogleApiKey ?? true;
  const settingsCredentials = getSettingsCredentialsByProvider(ai);
  const configuredProviders = new Set<AIProviderId>();

  for (const provider of AI_PROVIDER_CATALOG) {
    const settingsCredential = settingsCredentials.get(provider.id);
    const envApiKey =
      includeEnvFallback && provider.envApiKey
        ? trimToUndefined(process.env[provider.envApiKey])
        : undefined;
    const envBaseURL =
      includeEnvFallback && provider.envBaseURL
        ? trimToUndefined(process.env[provider.envBaseURL])
        : undefined;

    const apiKey =
      settingsCredential?.apiKey ??
      envApiKey ??
      (includeLegacyGoogleApiKey && provider.id === "google"
        ? trimToUndefined(ai.apiKey)
        : undefined);
    const baseURL = settingsCredential?.baseURL ?? envBaseURL;
    const hasSettingsEntry = settingsCredentials.has(provider.id);

    const isConfigured = provider.requiresApiKey
      ? Boolean(apiKey)
      : Boolean(apiKey || baseURL || hasSettingsEntry);

    if (isConfigured) {
      configuredProviders.add(provider.id);
    }
  }

  return configuredProviders;
};

export const isProviderConfigured = (
  ai: AISettingsLike,
  providerId: AIProviderId,
  options?: {
    includeEnvFallback?: boolean;
    includeLegacyGoogleApiKey?: boolean;
  },
) => getConfiguredProviderIds(ai, options).has(providerId);
