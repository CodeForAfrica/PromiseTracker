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

export type CuratedModel = {
  id: string;
  label: string;
};

export type ProviderCatalogItem = {
  id: AIProviderId;
  label: string;
  envApiKey?: string;
  envBaseURL?: string;
  requiresApiKey: boolean;
  curatedModels: CuratedModel[];
};

export const MODEL_ID_PATTERN = /^[a-z0-9-]+:\S+$/i;

export const AI_PROVIDER_CATALOG: ProviderCatalogItem[] = [
  {
    id: "google",
    label: "Google",
    envApiKey: "GOOGLE_GENERATIVE_AI_API_KEY",
    requiresApiKey: true,
    curatedModels: [
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
      { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
    ],
  },
  {
    id: "xai",
    label: "Grok (xAI)",
    envApiKey: "XAI_API_KEY",
    requiresApiKey: true,
    curatedModels: [
      { id: "grok-4", label: "Grok 4" },
      { id: "grok-3-mini", label: "Grok 3 Mini" },
    ],
  },
  {
    id: "openai",
    label: "OpenAI",
    envApiKey: "OPENAI_API_KEY",
    requiresApiKey: true,
    curatedModels: [
      { id: "gpt-5", label: "GPT-5" },
      { id: "gpt-5-mini", label: "GPT-5 Mini" },
      { id: "gpt-5-nano", label: "GPT-5 Nano" },
    ],
  },
  {
    id: "anthropic",
    label: "Anthropic",
    envApiKey: "ANTHROPIC_API_KEY",
    requiresApiKey: true,
    curatedModels: [
      { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
      { id: "claude-opus-4-1", label: "Claude Opus 4.1" },
      { id: "claude-3-5-haiku-latest", label: "Claude 3.5 Haiku Latest" },
    ],
  },
  {
    id: "mistral",
    label: "Mistral",
    envApiKey: "MISTRAL_API_KEY",
    requiresApiKey: true,
    curatedModels: [
      { id: "mistral-large-latest", label: "Mistral Large Latest" },
      { id: "mistral-medium-latest", label: "Mistral Medium Latest" },
      { id: "mistral-small-latest", label: "Mistral Small Latest" },
    ],
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    envApiKey: "DEEPSEEK_API_KEY",
    requiresApiKey: true,
    curatedModels: [
      { id: "deepseek-chat", label: "DeepSeek Chat" },
      { id: "deepseek-reasoner", label: "DeepSeek Reasoner" },
    ],
  },
  {
    id: "cerebras",
    label: "Cerebras",
    envApiKey: "CEREBRAS_API_KEY",
    requiresApiKey: true,
    curatedModels: [
      { id: "llama3.3-70b", label: "Llama 3.3 70B" },
      { id: "llama3.1-8b", label: "Llama 3.1 8B" },
    ],
  },
  {
    id: "groq",
    label: "Groq",
    envApiKey: "GROQ_API_KEY",
    requiresApiKey: true,
    curatedModels: [
      { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B Versatile" },
      { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant" },
    ],
  },
  {
    id: "togetherai",
    label: "Together AI",
    envApiKey: "TOGETHER_API_KEY",
    requiresApiKey: true,
    curatedModels: [
      {
        id: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
        label: "Meta Llama 3.1 70B Instruct Turbo",
      },
      {
        id: "Qwen/Qwen2.5-Coder-32B-Instruct",
        label: "Qwen 2.5 Coder 32B Instruct",
      },
    ],
  },
  {
    id: "cohere",
    label: "Cohere",
    envApiKey: "COHERE_API_KEY",
    requiresApiKey: true,
    curatedModels: [
      { id: "command-r-plus", label: "Command R Plus" },
      { id: "command-r", label: "Command R" },
    ],
  },
  {
    id: "fireworks",
    label: "Fireworks",
    envApiKey: "FIREWORKS_API_KEY",
    requiresApiKey: true,
    curatedModels: [
      {
        id: "accounts/fireworks/models/llama-v3-8b-instruct",
        label: "Llama V3 8B Instruct",
      },
      {
        id: "accounts/fireworks/models/llama-v3p1-70b-instruct",
        label: "Llama 3.1 70B Instruct",
      },
    ],
  },
  {
    id: "deepinfra",
    label: "DeepInfra",
    envApiKey: "DEEPINFRA_API_KEY",
    requiresApiKey: true,
    curatedModels: [
      {
        id: "meta-llama/Meta-Llama-3.1-70B-Instruct",
        label: "Meta Llama 3.1 70B Instruct",
      },
      { id: "Qwen/Qwen2.5-72B-Instruct", label: "Qwen 2.5 72B Instruct" },
    ],
  },
  {
    id: "perplexity",
    label: "Perplexity",
    envApiKey: "PERPLEXITY_API_KEY",
    requiresApiKey: true,
    curatedModels: [
      { id: "sonar-pro", label: "Sonar Pro" },
      { id: "sonar", label: "Sonar" },
    ],
  },
  {
    id: "ollama",
    label: "Ollama",
    envApiKey: "OLLAMA_API_KEY",
    envBaseURL: "OLLAMA_BASE_URL",
    requiresApiKey: false,
    curatedModels: [
      { id: "llama3.1:8b", label: "Llama 3.1 8B" },
      { id: "llama3.1:70b", label: "Llama 3.1 70B" },
      { id: "mistral:7b", label: "Mistral 7B" },
    ],
  },
];

export const DEFAULT_MODEL_PRESET: ProviderModelId = "google:gemini-2.5-pro";

export const AI_PROVIDER_OPTIONS = AI_PROVIDER_CATALOG.map((provider) => ({
  value: provider.id,
  label: provider.label,
}));

export const MODEL_PRESET_OPTIONS = AI_PROVIDER_CATALOG.flatMap((provider) =>
  provider.curatedModels.map((model) => ({
    value: `${provider.id}:${model.id}`,
    label: `[${provider.label}] ${model.label}`,
  })),
);

export const getProviderCatalogItem = (providerId: string) =>
  AI_PROVIDER_CATALOG.find((provider) => provider.id === providerId);

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
