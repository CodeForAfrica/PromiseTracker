import {
  AI_PROVIDER_OPTIONS,
  getConfiguredProviderIds,
  getModelPresetOptions,
  getProviderCatalogItem,
  isProviderIdSupportedForExtraction,
  isProviderModelId,
  isProviderModelSupportedForExtraction,
  splitProviderModelId,
  type AIProviderId,
} from "@/lib/ai/providerCatalog";
import { validateProviderApiKey } from "@/lib/ai/providerCredentialValidation";
import { trimToUndefined } from "@/lib/ai/stringUtils";
import type { Tab } from "payload";

type AIProviderCredentialRow = {
  provider?: string | null;
  apiKey?: string | null;
  baseURL?: string | null;
};

type AISettingsFormValue = {
  modelProvider?: string | null;
  modelPreset?: string | null;
  customModelId?: string | null;
  model?: string | null;
  apiKey?: string | null;
  providerCredentials?: AIProviderCredentialRow[] | null;
};

const MODEL_PRESET_OPTIONS = getModelPresetOptions({
  requireExtractionCapabilities: true,
  includeProviderInLabel: false,
});

const asAISettingsFormValue = (value: unknown): AISettingsFormValue => {
  if (!value || typeof value !== "object") {
    return {};
  }

  return value as AISettingsFormValue;
};

const mergeAISettingsContext = ({
  data,
  siblingData,
}: {
  data?: unknown;
  siblingData?: unknown;
}): AISettingsFormValue => {
  const nestedAiData =
    data && typeof data === "object" && "ai" in data
      ? asAISettingsFormValue((data as { ai?: unknown }).ai)
      : {};
  const rootData = asAISettingsFormValue(data);
  const sibling = asAISettingsFormValue(siblingData);

  return {
    ...nestedAiData,
    ...rootData,
    ...sibling,
    providerCredentials:
      sibling.providerCredentials ??
      nestedAiData.providerCredentials ??
      rootData.providerCredentials,
    modelProvider:
      sibling.modelProvider ??
      nestedAiData.modelProvider ??
      rootData.modelProvider,
    modelPreset:
      sibling.modelPreset ?? nestedAiData.modelPreset ?? rootData.modelPreset,
    customModelId:
      sibling.customModelId ??
      nestedAiData.customModelId ??
      rootData.customModelId,
    model: sibling.model ?? nestedAiData.model ?? rootData.model,
    apiKey: sibling.apiKey ?? nestedAiData.apiKey ?? rootData.apiKey,
  };
};

const normalizeProviderId = (value: unknown): AIProviderId | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  return getProviderCatalogItem(normalized)?.id;
};

const providerFromModelId = (value: unknown): AIProviderId | undefined => {
  if (typeof value !== "string" || !isProviderModelId(value)) {
    return undefined;
  }

  return splitProviderModelId(value).providerId;
};

const getSelectedProvider = (
  aiValue: AISettingsFormValue,
): AIProviderId | undefined => {
  const explicitProvider = normalizeProviderId(aiValue.modelProvider);
  if (explicitProvider) {
    return explicitProvider;
  }

  const customProvider = providerFromModelId(aiValue.customModelId);
  if (customProvider) {
    return customProvider;
  }

  const presetProvider = providerFromModelId(aiValue.modelPreset);
  if (presetProvider) {
    return presetProvider;
  }
};

const getProviderDisplayName = (providerId: AIProviderId) =>
  getProviderCatalogItem(providerId)?.label ?? providerId;

type SelectOptionLike = string | { value?: string | null };

const readOptionValue = (option: SelectOptionLike) => {
  if (typeof option === "string") {
    return option;
  }

  return typeof option.value === "string" ? option.value : undefined;
};

const getUniqueProvidersError = (value: unknown): string | null => {
  if (!Array.isArray(value)) {
    return null;
  }

  const seenProviders = new Set<string>();

  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }

    const provider =
      "provider" in entry && typeof entry.provider === "string"
        ? entry.provider.trim().toLowerCase()
        : "";

    if (!provider) {
      continue;
    }

    if (seenProviders.has(provider)) {
      return `Provider "${provider}" appears more than once.`;
    }

    seenProviders.add(provider);
  }

  return null;
};

const validateUniqueProviderCredentials = (value: unknown) =>
  getUniqueProvidersError(value) ?? true;

const validateProviderCredentialApiKey = async (
  value: string | null | undefined,
  {
    siblingData,
  }: {
    siblingData?: unknown;
  } = {},
) => {
  const apiKey = trimToUndefined(value);
  if (!apiKey) {
    return true;
  }

  const credential =
    siblingData && typeof siblingData === "object"
      ? (siblingData as AIProviderCredentialRow)
      : undefined;
  const providerId = normalizeProviderId(credential?.provider);
  if (!providerId || providerId === "ollama") {
    return true;
  }

  const status = await validateProviderApiKey({
    providerId,
    apiKey,
    baseURL: trimToUndefined(credential?.baseURL),
  });

  if (status === "invalid") {
    return `Invalid API key for "${getProviderDisplayName(providerId)}".`;
  }

  return true;
};

const filterConfiguredProviderOptions = <T extends SelectOptionLike>(
  options: T[],
  context: {
    data?: unknown;
    siblingData?: unknown;
  },
) => {
  const aiValue = mergeAISettingsContext(context);
  const configuredProviders = getConfiguredProviderIds(aiValue);
  const explicitProvider = normalizeProviderId(aiValue.modelProvider);
  if (explicitProvider) {
    configuredProviders.add(explicitProvider);
  }

  const extractionCapableOptions = options.filter((option) => {
    const providerValue = readOptionValue(option);
    if (!providerValue) {
      return false;
    }

    return isProviderIdSupportedForExtraction(providerValue);
  });

  if (configuredProviders.size === 0) {
    return extractionCapableOptions;
  }

  const configuredOptions = extractionCapableOptions.filter((option) => {
    const providerValue = readOptionValue(option);
    if (!providerValue) {
      return false;
    }

    return configuredProviders.has(providerValue as AIProviderId);
  });

  return configuredOptions.length > 0
    ? configuredOptions
    : extractionCapableOptions;
};

const filterExtractionModelOptions = <T extends SelectOptionLike>(
  options: T[],
  selectedProvider: AIProviderId | undefined,
) =>
  options.filter((option) => {
    const modelValue = readOptionValue(option);
    if (!modelValue || !isProviderModelId(modelValue)) {
      return false;
    }

    const { providerId } = splitProviderModelId(modelValue);
    if (selectedProvider && providerId !== selectedProvider) {
      return false;
    }

    return isProviderModelSupportedForExtraction(modelValue);
  });

const filterConfiguredModelOptions = <T extends SelectOptionLike>(
  options: T[],
  context: {
    data?: unknown;
    siblingData?: unknown;
  },
) => {
  const aiValue = mergeAISettingsContext(context);
  const selectedProvider = getSelectedProvider(aiValue);
  const configuredProviders = getConfiguredProviderIds(aiValue);
  if (selectedProvider) {
    configuredProviders.add(selectedProvider);
  }

  const extractionModelOptions = filterExtractionModelOptions(
    options,
    selectedProvider,
  );

  if (configuredProviders.size === 0) {
    return extractionModelOptions;
  }

  const configuredModelOptions = extractionModelOptions.filter((option) => {
    const modelValue = readOptionValue(option);
    if (!modelValue || !isProviderModelId(modelValue)) {
      return false;
    }

    const { providerId } = splitProviderModelId(modelValue);

    if (!configuredProviders.has(providerId)) {
      return false;
    }

    return true;
  });

  return configuredModelOptions.length > 0
    ? configuredModelOptions
    : extractionModelOptions;
};

const validateModelProvider = (
  value: string | null | undefined,
  {
    data,
    siblingData,
  }: {
    data?: unknown;
    siblingData?: unknown;
  } = {},
) => {
  const providerId = normalizeProviderId(value);
  if (!providerId) {
    return "Select a valid provider.";
  }

  const aiValue = mergeAISettingsContext({ data, siblingData });

  if (!getConfiguredProviderIds(aiValue).has(providerId)) {
    return `Configure credentials for "${getProviderDisplayName(
      providerId,
    )}" before selecting this provider.`;
  }

  if (!isProviderIdSupportedForExtraction(providerId)) {
    return `Provider "${getProviderDisplayName(
      providerId,
    )}" is not configured for structured output + tool calling extraction.`;
  }

  return true;
};

const inferModelProviderValue = ({
  value,
  data,
  siblingData,
}: {
  value: unknown;
  data?: unknown;
  siblingData?: unknown;
}) => {
  const explicitProvider = normalizeProviderId(value);
  if (explicitProvider) {
    return explicitProvider;
  }

  const aiValue = mergeAISettingsContext({ data, siblingData });
  return getSelectedProvider(aiValue);
};

const validateModelPreset = (
  value: string | null | undefined,
  {
    data,
    siblingData,
  }: {
    data?: unknown;
    siblingData?: unknown;
  } = {},
) => {
  const aiValue = mergeAISettingsContext({ data, siblingData });

  if (!value) {
    const customModelId = trimToUndefined(aiValue.customModelId);
    if (customModelId) {
      return true;
    }

    return "Select a model preset or provide a custom model ID.";
  }

  if (!isProviderModelId(value)) {
    return 'Use format "provider:model", for example "openai:gpt-4o".';
  }

  const selectedProvider = getSelectedProvider(aiValue);
  if (!selectedProvider) {
    return "Select a model provider first.";
  }

  const { providerId } = splitProviderModelId(value);

  if (providerId !== selectedProvider) {
    return `Selected model must belong to "${getProviderDisplayName(
      selectedProvider,
    )}".`;
  }

  if (!getConfiguredProviderIds(aiValue).has(providerId)) {
    return `Configure credentials for "${getProviderDisplayName(
      providerId,
    )}" before selecting its models.`;
  }

  if (!isProviderModelSupportedForExtraction(value)) {
    return "Selected model is not configured for structured output + tool calling extraction.";
  }

  return true;
};

const validateProviderModelId = (
  value: string | null | undefined,
  {
    data,
    siblingData,
  }: {
    data?: unknown;
    siblingData?: unknown;
  } = {},
) => {
  if (!value) {
    return true;
  }

  if (!isProviderModelId(value)) {
    return 'Use format "provider:model", for example "openai:gpt-5".';
  }

  const aiValue = mergeAISettingsContext({ data, siblingData });
  const selectedProvider = getSelectedProvider(aiValue);
  const { providerId } = splitProviderModelId(value);

  if (!getConfiguredProviderIds(aiValue).has(providerId)) {
    return `Configure credentials for "${getProviderDisplayName(
      providerId,
    )}" before using a custom model.`;
  }

  if (selectedProvider && providerId !== selectedProvider) {
    return `Custom model provider must match "${getProviderDisplayName(
      selectedProvider,
    )}".`;
  }

  if (!isProviderModelSupportedForExtraction(value)) {
    return "Custom model provider is not configured for structured output + tool calling extraction.";
  }

  return true;
};

export const AITab: Tab = {
  label: {
    en: "Generative AI",
    fr: "IA Générative",
  },
  fields: [
    {
      name: "ai",
      type: "group",
      label: "",
      admin: {
        hideGutter: true,
      },
      fields: [
        {
          name: "providerCredentials",
          type: "array",
          label: {
            en: "Provider Credentials",
            fr: "Identifiants des fournisseurs",
          },
          validate: validateUniqueProviderCredentials,
          admin: {
            description:
              "Add credentials first. Only configured providers can be selected for extraction models.",
            components: {
              RowLabel: "@/globals/Settings/tabs/RowLabel#AIProviderRowLabel",
            },
          },
          fields: [
            {
              type: "row",
              fields: [
                {
                  name: "provider",
                  type: "select",
                  required: true,
                  label: {
                    en: "Provider",
                    fr: "Fournisseur",
                  },
                  options: AI_PROVIDER_OPTIONS,
                },
                {
                  name: "apiKey",
                  type: "text",
                  label: {
                    en: "API Key",
                    fr: "Clé API",
                  },
                  admin: {
                    description:
                      "Optional if configured in environment variables. Saved keys are validated when possible.",
                    components: {
                      Field:
                        "@/globals/Settings/tabs/MaskedApiKeyField#MaskedApiKeyField",
                    },
                  },
                  validate: validateProviderCredentialApiKey,
                },
                {
                  name: "baseURL",
                  type: "text",
                  label: {
                    en: "Base URL",
                    fr: "URL de base",
                  },
                  admin: {
                    condition: (
                      _: unknown,
                      siblingData: { provider?: string } | undefined,
                    ) => siblingData?.provider === "ollama",
                    description:
                      "Optional Ollama base URL (e.g. http://localhost:11434).",
                  },
                },
              ],
            },
          ],
        },
        {
          type: "row",
          fields: [
            {
              name: "modelProvider",
              type: "select",
              required: true,
              label: {
                en: "Model Provider",
                fr: "Fournisseur de modèle",
              },
              options: AI_PROVIDER_OPTIONS,
              filterOptions: (args) => {
                const { siblingData, data } = args as {
                  siblingData: unknown;
                  data: unknown;
                };

                return filterConfiguredProviderOptions(AI_PROVIDER_OPTIONS, {
                  data,
                  siblingData,
                }) as typeof args.options;
              },
              validate: validateModelProvider,
              hooks: {
                beforeValidate: [
                  ((args: unknown) =>
                    inferModelProviderValue({
                      value: (args as { value?: unknown }).value,
                      data: (args as { data?: unknown }).data,
                      siblingData: (args as { siblingData?: unknown })
                        .siblingData,
                    })) as never,
                ],
              },
              admin: {
                description:
                  "Only providers with credentials configured in Settings or environment are listed.",
              },
            },
            {
              name: "modelPreset",
              type: "select",
              label: {
                en: "Model Preset",
                fr: "Modèle prédéfini",
              },
              options: MODEL_PRESET_OPTIONS,
              filterOptions: (args) => {
                const { siblingData, data } = args as {
                  siblingData: unknown;
                  data: unknown;
                };

                return filterConfiguredModelOptions(MODEL_PRESET_OPTIONS, {
                  data,
                  siblingData,
                }) as typeof args.options;
              },
              validate: validateModelPreset,
              admin: {
                description:
                  "Model suggestions are inferred from installed AI SDK provider model IDs.",
              },
            },
          ],
        },
        {
          name: "customModelId",
          label: {
            en: "Custom Model ID",
            fr: "ID de modèle personnalisé",
          },
          type: "text",
          validate: validateProviderModelId,
          admin: {
            description:
              'Optional override in "provider:model" format. Must match the selected provider.',
          },
        },
        {
          name: "model",
          type: "select",
          label: {
            en: "Legacy Model (Deprecated)",
            fr: "Modèle hérité (déprécié)",
          },
          options: [
            {
              value: "gemini-2.5-pro",
              label: "Gemini 2.5 Pro",
            },
            {
              value: "gemini-2.5-flash-lite",
              label: "Gemini 2.5 Flash Lite",
            },
          ],
          admin: {
            condition: () => false,
          },
        },
        {
          name: "apiKey",
          label: {
            en: "Legacy API Key (Deprecated)",
            fr: "Clé API héritée (dépréciée)",
          },
          type: "text",
          admin: {
            condition: () => false,
          },
        },
      ],
    },
  ],
};
