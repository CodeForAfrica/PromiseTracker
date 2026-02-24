import { GlobalConfig } from "payload";
import {
  AI_PROVIDER_OPTIONS,
  DEFAULT_MODEL_PRESET,
  MODEL_PRESET_OPTIONS,
  isProviderModelId,
} from "@/lib/ai/providerCatalog";

const validateProviderModelId = (value: string | null | undefined) => {
  if (!value) {
    return true;
  }

  if (!isProviderModelId(value)) {
    return 'Use format "provider:model", for example "openai:gpt-5".';
  }

  return true;
};

const validateUniqueProviderCredentials = (value: unknown) => {
  if (!Array.isArray(value)) {
    return true;
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

  return true;
};

export const Settings: GlobalConfig = {
  slug: "settings",
  label: {
    en: "Settings",
    fr: "Paramètres",
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
  },
  admin: {
    group: {
      en: "Settings",
      fr: "Paramètres",
    },
  },
  fields: [
    {
      type: "tabs",
      label: {
        en: "Airtable",
        fr: "Airtable",
      },
      tabs: [
        {
          label: {
            en: "Airtable",
            fr: "Airtable",
          },
          fields: [
            {
              name: "airtable",
              type: "group",
              label: "",
              admin: {
                hideGutter: true,
              },
              fields: [
                {
                  type: "row",
                  fields: [
                    {
                      name: "airtableAPIKey",
                      label: {
                        en: "Airtable API Key",
                        fr: "Clé API Airtable",
                      },
                      type: "text",
                      required: true,
                    },
                    {
                      name: "airtableBaseID",
                      label: {
                        en: "Airtable Base ID",
                        fr: "ID de Base Airtable",
                      },
                      type: "text",
                      required: true,
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
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
                  type: "row",
                  fields: [
                    {
                      name: "modelPreset",
                      type: "select",
                      label: {
                        en: "Model Preset",
                        fr: "Modèle prédéfini",
                      },
                      options: MODEL_PRESET_OPTIONS,
                      defaultValue: DEFAULT_MODEL_PRESET,
                      required: true,
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
                          'Optional override in "provider:model" format. Example: "openai:gpt-5".',
                      },
                    },
                  ],
                },
                {
                  name: "providerCredentials",
                  type: "array",
                  label: {
                    en: "Provider Credentials",
                    fr: "Identifiants des fournisseurs",
                  },
                  validate: validateUniqueProviderCredentials,
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
                              "Optional if configured in environment variables.",
                          },
                        },
                        {
                          name: "baseURL",
                          type: "text",
                          label: {
                            en: "Base URL",
                            fr: "URL de base",
                          },
                          admin: {
                            condition: (_, siblingData) =>
                              siblingData?.provider === "ollama",
                            description:
                              "Optional Ollama base URL (e.g. http://localhost:11434).",
                          },
                        },
                      ],
                    },
                  ],
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
        },
        {
          label: {
            en: "Meedan",
            fr: "Meedan",
          },
          fields: [
            {
              name: "meedan",
              type: "group",
              label: {
                en: "Meedan Settings",
                fr: "Paramètres Meedan",
              },
              fields: [
                {
                  type: "row",
                  fields: [
                    {
                      name: "meedanAPIKey",
                      type: "text",
                      required: true,
                      label: {
                        en: "Meedan API Key",
                        fr: "Clé API Meedan",
                      },
                    },
                    {
                      name: "teamId",
                      type: "text",
                      required: true,
                      label: {
                        en: "Team ID",
                        fr: "ID d'Équipe",
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};
