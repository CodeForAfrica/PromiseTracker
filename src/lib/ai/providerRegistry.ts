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
import { createProviderRegistry, type LanguageModel } from "ai";
import {
  AI_PROVIDER_CATALOG,
  DEFAULT_MODEL_PRESET,
  getProviderCatalogItem,
  isProviderModelId,
  splitProviderModelId,
  type AIProviderId,
  type ProviderModelId,
} from "./providerCatalog";

export type AIProviderCredentialInput = {
  provider?: string | null;
  apiKey?: string | null;
  baseURL?: string | null;
};

export type AISettingsInput = {
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

const trimToUndefined = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
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

  if (options?.strict && provider.requiresApiKey && !apiKey) {
    const keyName = provider.envApiKey ?? "an API key";
    throw new Error(
      `Missing API key for provider "${provider.label}". Configure it in Settings or set ${keyName}.`,
    );
  }

  return {
    apiKey,
    baseURL,
  };
};

const normalizeOllamaBaseURL = (baseURL?: string) => {
  const defaultBaseURL = "http://127.0.0.1:11434/v1";
  if (!baseURL) {
    return defaultBaseURL;
  }

  const sanitized = baseURL.replace(/\/+$/, "");
  return sanitized.endsWith("/v1") ? sanitized : `${sanitized}/v1`;
};

export const buildLanguageModelRegistry = (ai: AISettingsInput) => {
  const getCredentials = (providerId: AIProviderId) => {
    const credentials = resolveProviderCredentials(ai, providerId);
    return {
      apiKey: trimToUndefined(credentials.apiKey),
      baseURL: trimToUndefined(credentials.baseURL),
    };
  };

  const googleCredentials = getCredentials("google");
  const xaiCredentials = getCredentials("xai");
  const openaiCredentials = getCredentials("openai");
  const anthropicCredentials = getCredentials("anthropic");
  const mistralCredentials = getCredentials("mistral");
  const deepseekCredentials = getCredentials("deepseek");
  const cerebrasCredentials = getCredentials("cerebras");
  const groqCredentials = getCredentials("groq");
  const togetherCredentials = getCredentials("togetherai");
  const cohereCredentials = getCredentials("cohere");
  const fireworksCredentials = getCredentials("fireworks");
  const deepinfraCredentials = getCredentials("deepinfra");
  const perplexityCredentials = getCredentials("perplexity");
  const ollamaCredentials = getCredentials("ollama");

  const providers = {
    google: createGoogleGenerativeAI({
      ...(googleCredentials.apiKey ? { apiKey: googleCredentials.apiKey } : {}),
      ...(googleCredentials.baseURL
        ? { baseURL: googleCredentials.baseURL }
        : {}),
    }),
    xai: createXai({
      ...(xaiCredentials.apiKey ? { apiKey: xaiCredentials.apiKey } : {}),
      ...(xaiCredentials.baseURL ? { baseURL: xaiCredentials.baseURL } : {}),
    }),
    openai: createOpenAI({
      ...(openaiCredentials.apiKey ? { apiKey: openaiCredentials.apiKey } : {}),
      ...(openaiCredentials.baseURL
        ? { baseURL: openaiCredentials.baseURL }
        : {}),
    }),
    anthropic: createAnthropic({
      ...(anthropicCredentials.apiKey
        ? { apiKey: anthropicCredentials.apiKey }
        : {}),
      ...(anthropicCredentials.baseURL
        ? { baseURL: anthropicCredentials.baseURL }
        : {}),
    }),
    mistral: createMistral({
      ...(mistralCredentials.apiKey
        ? { apiKey: mistralCredentials.apiKey }
        : {}),
      ...(mistralCredentials.baseURL
        ? { baseURL: mistralCredentials.baseURL }
        : {}),
    }),
    deepseek: createDeepSeek({
      ...(deepseekCredentials.apiKey
        ? { apiKey: deepseekCredentials.apiKey }
        : {}),
      ...(deepseekCredentials.baseURL
        ? { baseURL: deepseekCredentials.baseURL }
        : {}),
    }),
    cerebras: createCerebras({
      ...(cerebrasCredentials.apiKey
        ? { apiKey: cerebrasCredentials.apiKey }
        : {}),
      ...(cerebrasCredentials.baseURL
        ? { baseURL: cerebrasCredentials.baseURL }
        : {}),
    }),
    groq: createGroq({
      ...(groqCredentials.apiKey ? { apiKey: groqCredentials.apiKey } : {}),
      ...(groqCredentials.baseURL ? { baseURL: groqCredentials.baseURL } : {}),
    }),
    togetherai: createTogetherAI({
      ...(togetherCredentials.apiKey
        ? { apiKey: togetherCredentials.apiKey }
        : {}),
      ...(togetherCredentials.baseURL
        ? { baseURL: togetherCredentials.baseURL }
        : {}),
    }),
    cohere: createCohere({
      ...(cohereCredentials.apiKey ? { apiKey: cohereCredentials.apiKey } : {}),
      ...(cohereCredentials.baseURL
        ? { baseURL: cohereCredentials.baseURL }
        : {}),
    }),
    fireworks: createFireworks({
      ...(fireworksCredentials.apiKey
        ? { apiKey: fireworksCredentials.apiKey }
        : {}),
      ...(fireworksCredentials.baseURL
        ? { baseURL: fireworksCredentials.baseURL }
        : {}),
    }),
    deepinfra: createDeepInfra({
      ...(deepinfraCredentials.apiKey
        ? { apiKey: deepinfraCredentials.apiKey }
        : {}),
      ...(deepinfraCredentials.baseURL
        ? { baseURL: deepinfraCredentials.baseURL }
        : {}),
    }),
    perplexity: createPerplexity({
      ...(perplexityCredentials.apiKey
        ? { apiKey: perplexityCredentials.apiKey }
        : {}),
      ...(perplexityCredentials.baseURL
        ? { baseURL: perplexityCredentials.baseURL }
        : {}),
    }),
    ollama: createOpenAICompatible({
      name: "ollama",
      baseURL: normalizeOllamaBaseURL(ollamaCredentials.baseURL),
      ...(ollamaCredentials.apiKey ? { apiKey: ollamaCredentials.apiKey } : {}),
    }),
  };

  return createProviderRegistry(providers as never);
};

export const resolveConfiguredLanguageModel = (
  ai: AISettingsInput,
): ResolvedLanguageModel => {
  const modelId = resolveConfiguredModelId(ai);
  const { providerId } = splitProviderModelId(modelId);

  if (!AI_PROVIDER_CATALOG.some((provider) => provider.id === providerId)) {
    throw new Error(`Unsupported provider "${providerId}".`);
  }

  resolveProviderCredentials(ai, providerId, { strict: true });

  const registry = buildLanguageModelRegistry(ai);

  return {
    model: registry.languageModel(modelId),
    modelId,
    providerId,
  };
};
