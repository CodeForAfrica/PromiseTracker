import type { AIProviderId } from "./providerCatalog";
import { trimToUndefined } from "./stringUtils";

export type ApiKeyValidationStatus = "valid" | "invalid" | "skipped";

type ValidateProviderApiKeyInput = {
  providerId: AIProviderId;
  apiKey: string;
  baseURL?: string;
};

const VALIDATION_CACHE_TTL_MS = 5 * 60 * 1000;
const VALIDATION_TIMEOUT_MS = 5_000;

const validationCache = new Map<
  string,
  {
    status: ApiKeyValidationStatus;
    expiresAt: number;
  }
>();

const OPENAI_COMPATIBLE_BASE_URLS: Partial<Record<AIProviderId, string>> = {
  xai: "https://api.x.ai/v1",
  openai: "https://api.openai.com/v1",
  mistral: "https://api.mistral.ai/v1",
  deepseek: "https://api.deepseek.com/v1",
  cerebras: "https://api.cerebras.ai/v1",
  groq: "https://api.groq.com/openai/v1",
  togetherai: "https://api.together.xyz/v1",
  fireworks: "https://api.fireworks.ai/inference/v1",
  deepinfra: "https://api.deepinfra.com/v1/openai",
  perplexity: "https://api.perplexity.ai",
};

const normalizeBaseURL = (baseURL?: string) => {
  if (!baseURL) {
    return undefined;
  }

  return baseURL.replace(/\/+$/, "");
};

const withPath = (baseURL: string, pathSegment: string) => {
  const normalized = normalizeBaseURL(baseURL);
  if (!normalized) {
    return pathSegment;
  }

  return normalized.endsWith(pathSegment)
    ? normalized
    : `${normalized}${pathSegment}`;
};

const requestValidation = async ({
  url,
  headers,
  invalidStatusCodes,
}: {
  url: string;
  headers: Record<string, string>;
  invalidStatusCodes?: number[];
}): Promise<ApiKeyValidationStatus> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VALIDATION_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers,
      signal: controller.signal,
    });

    if ((invalidStatusCodes ?? [401, 403]).includes(response.status)) {
      return "invalid";
    }

    if (response.ok) {
      return "valid";
    }

    return "skipped";
  } catch {
    return "skipped";
  } finally {
    clearTimeout(timeout);
  }
};

const validateOpenAICompatibleKey = async ({
  providerId,
  apiKey,
  baseURL,
}: ValidateProviderApiKeyInput): Promise<ApiKeyValidationStatus> => {
  const defaultBaseURL = OPENAI_COMPATIBLE_BASE_URLS[providerId];
  if (!defaultBaseURL && !baseURL) {
    return "skipped";
  }

  const endpoint = withPath(baseURL ?? defaultBaseURL ?? "", "/models");

  return requestValidation({
    url: endpoint,
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    invalidStatusCodes: [400, 401, 403],
  });
};

const validateGoogleApiKey = async (
  apiKey: string,
): Promise<ApiKeyValidationStatus> => {
  const endpoint = "https://generativelanguage.googleapis.com/v1beta/models";

  return requestValidation({
    url: endpoint,
    headers: {
      "x-goog-api-key": apiKey,
    },
    invalidStatusCodes: [400, 401, 403],
  });
};

const validateAnthropicApiKey = async ({
  apiKey,
  baseURL,
}: ValidateProviderApiKeyInput): Promise<ApiKeyValidationStatus> => {
  const endpoint = withPath(baseURL ?? "https://api.anthropic.com", "/v1/models");

  return requestValidation({
    url: endpoint,
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    invalidStatusCodes: [400, 401, 403],
  });
};

const validateCohereApiKey = async ({
  apiKey,
  baseURL,
}: ValidateProviderApiKeyInput): Promise<ApiKeyValidationStatus> => {
  const endpoint = withPath(baseURL ?? "https://api.cohere.com", "/v2/models");

  return requestValidation({
    url: endpoint,
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    invalidStatusCodes: [400, 401, 403],
  });
};

const buildCacheKey = ({ providerId, apiKey, baseURL }: ValidateProviderApiKeyInput) =>
  `${providerId}:${apiKey}:${normalizeBaseURL(baseURL) ?? ""}`;

export const validateProviderApiKey = async (
  input: ValidateProviderApiKeyInput,
): Promise<ApiKeyValidationStatus> => {
  const providerId = input.providerId;
  const apiKey = trimToUndefined(input.apiKey);

  if (!apiKey || providerId === "ollama") {
    return "skipped";
  }

  const normalizedInput = {
    ...input,
    apiKey,
    baseURL: normalizeBaseURL(input.baseURL),
  };

  const cacheKey = buildCacheKey(normalizedInput);
  const now = Date.now();
  const cached = validationCache.get(cacheKey);

  if (cached && cached.expiresAt > now) {
    return cached.status;
  }

  let status: ApiKeyValidationStatus;

  switch (providerId) {
    case "google":
      status = await validateGoogleApiKey(apiKey);
      break;
    case "anthropic":
      status = await validateAnthropicApiKey(normalizedInput);
      break;
    case "cohere":
      status = await validateCohereApiKey(normalizedInput);
      break;
    default:
      status = await validateOpenAICompatibleKey(normalizedInput);
      break;
  }

  validationCache.set(cacheKey, {
    status,
    expiresAt: now + VALIDATION_CACHE_TTL_MS,
  });

  return status;
};
