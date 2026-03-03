import { createAnthropic } from "@ai-sdk/anthropic";
import { createCerebras } from "@ai-sdk/cerebras";
import { createCohere } from "@ai-sdk/cohere";
import { createDeepInfra } from "@ai-sdk/deepinfra";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createFireworks } from "@ai-sdk/fireworks";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createMistral } from "@ai-sdk/mistral";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createPerplexity } from "@ai-sdk/perplexity";
import { createTogetherAI } from "@ai-sdk/togetherai";
import { createXai } from "@ai-sdk/xai";
import { type LanguageModel } from "ai";
import {
  AI_PROVIDER_CATALOG,
  DEFAULT_MODEL_PRESET,
  getProviderCatalogItem,
  isProviderConfigured,
  isProviderModelId,
  isProviderModelSupportedForExtraction,
  splitProviderModelId,
  type AIProviderId,
  type ProviderModelId,
} from "./providerCatalog";
import { trimToUndefined } from "./stringUtils";

export type AIProviderCredentialInput = {
  provider?: string | null;
  apiKey?: string | null;
  baseURL?: string | null;
};

export type AISettingsInput = {
  modelProvider?: string | null;
  modelPreset?: string | null;
  customModelId?: string | null;
  model?: string | null; // Legacy Google model field.
  apiKey?: string | null; // Legacy Google API key field.
  providerCredentials?: AIProviderCredentialInput[] | null;
};

export type ResolvedProviderCredentials = {
  apiKey?: string;
  baseURL?: string;
};

export type ResolvedLanguageModel = {
  model: LanguageModel;
  modelId: ProviderModelId;
  providerId: AIProviderId;
};

const normalizeLegacyModelId = (legacyModel: string): ProviderModelId => {
  if (isProviderModelId(legacyModel)) {
    return legacyModel;
  }

  return `google:${legacyModel}` as ProviderModelId;
};

export const resolveConfiguredModelId = (
  ai: AISettingsInput,
): ProviderModelId => {
  const customModelId = trimToUndefined(ai.customModelId);
  if (customModelId) {
    if (!isProviderModelId(customModelId)) {
      throw new Error(
        `Invalid custom model "${customModelId}". Expected "provider:model".`,
      );
    }

    return customModelId;
  }

  const modelPreset = trimToUndefined(ai.modelPreset);
  if (modelPreset) {
    if (!isProviderModelId(modelPreset)) {
      throw new Error(
        `Invalid model preset "${modelPreset}". Expected "provider:model".`,
      );
    }

    return modelPreset;
  }

  const legacyModel = trimToUndefined(ai.model);
  if (legacyModel) {
    return normalizeLegacyModelId(legacyModel);
  }

  return DEFAULT_MODEL_PRESET;
};

const credentialsByProvider = (ai: AISettingsInput) => {
  const credentials = ai.providerCredentials ?? [];
  const map = new Map<AIProviderId, ResolvedProviderCredentials>();

  for (const credential of credentials) {
    const provider = trimToUndefined(credential?.provider)?.toLowerCase();
    if (!provider) {
      continue;
    }

    const providerCatalogItem = getProviderCatalogItem(provider);
    if (!providerCatalogItem) {
      continue;
    }

    map.set(providerCatalogItem.id, {
      apiKey: trimToUndefined(credential?.apiKey),
      baseURL: trimToUndefined(credential?.baseURL),
    });
  }

  return map;
};

export const resolveProviderCredentials = (
  ai: AISettingsInput,
  providerId: AIProviderId,
  options?: {
    strict?: boolean;
  },
): ResolvedProviderCredentials => {
  const provider = getProviderCatalogItem(providerId);

  if (!provider) {
    throw new Error(`Unsupported AI provider "${providerId}".`);
  }

  const providerCredentials = credentialsByProvider(ai).get(provider.id);
  const envApiKey = provider.envApiKey
    ? trimToUndefined(process.env[provider.envApiKey])
    : undefined;
  const envBaseURL = provider.envBaseURL
    ? trimToUndefined(process.env[provider.envBaseURL])
    : undefined;

  const apiKey =
    providerCredentials?.apiKey ??
    envApiKey ??
    (provider.id === "google" ? trimToUndefined(ai.apiKey) : undefined);
  const baseURL = providerCredentials?.baseURL ?? envBaseURL;

  if (options?.strict && !isProviderConfigured(ai, provider.id)) {
    const keyName = provider.envApiKey;
    const baseURLName = provider.envBaseURL;
    const instructions = provider.requiresApiKey
      ? keyName
        ? `set ${keyName}`
        : "set an API key"
      : baseURLName
        ? `set ${keyName ?? "an API key"} or ${baseURLName}`
        : "set provider credentials";

    throw new Error(
      `Missing credentials for provider "${provider.label}". Configure it in Settings or ${instructions}.`,
    );
  }

  return {
    apiKey,
    baseURL,
  };
};

const normalizeOllamaBaseURL = (baseURL?: string) => {
  const defaultBaseURL = "http://127.0.0.1:11434/v1";
  const trimmedBaseURL = trimToUndefined(baseURL);

  if (!trimmedBaseURL) {
    return defaultBaseURL;
  }

  try {
    const parsed = new URL(trimmedBaseURL);
    const sanitizedPath = parsed.pathname.replace(/\/+$/, "");

    if (!sanitizedPath || sanitizedPath === "/") {
      parsed.pathname = "/v1";
      return parsed.toString().replace(/\/+$/, "");
    }

    if (sanitizedPath === "/v1") {
      parsed.pathname = "/v1";
      return parsed.toString().replace(/\/+$/, "");
    }

    const v1SegmentIndex = sanitizedPath.indexOf("/v1/");
    if (v1SegmentIndex >= 0) {
      parsed.pathname = sanitizedPath.slice(0, v1SegmentIndex + 3);
      return parsed.toString().replace(/\/+$/, "");
    }

    parsed.pathname = sanitizedPath;
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return trimmedBaseURL.replace(/\/+$/, "") || defaultBaseURL;
  }
};

const resolveProviderLanguageModel = ({
  ai,
  providerId,
  providerModelId,
}: {
  ai: AISettingsInput;
  providerId: AIProviderId;
  providerModelId: string;
}): LanguageModel => {
  const credentials = resolveProviderCredentials(ai, providerId);
  const apiKey = trimToUndefined(credentials.apiKey);
  const baseURL = trimToUndefined(credentials.baseURL);
  const clientOptions = {
    ...(apiKey ? { apiKey } : {}),
    ...(baseURL ? { baseURL } : {}),
  };

  switch (providerId) {
    case "google":
      return createGoogleGenerativeAI(clientOptions)(providerModelId);
    case "xai":
      return createXai(clientOptions)(providerModelId);
    case "openai":
      return createOpenAI(clientOptions)(providerModelId);
    case "anthropic":
      return createAnthropic(clientOptions)(providerModelId);
    case "mistral":
      return createMistral(clientOptions)(providerModelId);
    case "deepseek":
      return createDeepSeek(clientOptions)(providerModelId);
    case "cerebras":
      return createCerebras(clientOptions)(providerModelId);
    case "groq":
      return createGroq(clientOptions)(providerModelId);
    case "togetherai":
      return createTogetherAI(clientOptions)(providerModelId);
    case "cohere":
      return createCohere(clientOptions)(providerModelId);
    case "fireworks":
      return createFireworks(clientOptions)(providerModelId);
    case "deepinfra":
      return createDeepInfra(clientOptions)(providerModelId);
    case "perplexity":
      return createPerplexity(clientOptions)(providerModelId);
    case "ollama":
      return createOpenAICompatible({
        name: "ollama",
        baseURL: normalizeOllamaBaseURL(baseURL),
        ...(apiKey ? { apiKey } : {}),
      })(providerModelId);
    default:
      throw new Error(`Unsupported AI provider "${providerId}".`);
  }
};

export const resolveConfiguredLanguageModel = (
  ai: AISettingsInput,
  options?: {
    requireExtractionCapabilities?: boolean;
  },
): ResolvedLanguageModel => {
  const modelId = resolveConfiguredModelId(ai);
  const { providerId, modelId: providerModelId } = splitProviderModelId(modelId);

  if (!AI_PROVIDER_CATALOG.some((provider) => provider.id === providerId)) {
    throw new Error(`Unsupported provider "${providerId}".`);
  }

  resolveProviderCredentials(ai, providerId, { strict: true });

  if (
    options?.requireExtractionCapabilities &&
    !isProviderModelSupportedForExtraction(modelId)
  ) {
    const provider = getProviderCatalogItem(providerId);
    throw new Error(
      `Model "${modelId}" from provider "${provider?.label ?? providerId}" is not configured for structured output + tool calling extraction.`,
    );
  }

  return {
    model: resolveProviderLanguageModel({
      ai,
      providerId,
      providerModelId,
    }),
    modelId,
    providerId,
  };
};

