import type { Tab } from "payload";
import { encryptedSecretField } from "@/fields/encryptedSecret";

export const AirtableTab: Tab = {
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
            encryptedSecretField({
              name: "airtableAPIKey",
              label: {
                en: "Airtable API Key",
                fr: "Clé API Airtable",
              },
              required: true,
              admin: {
                components: {
                  Field:
                    "@/globals/Settings/tabs/MaskedApiKeyField#MaskedApiKeyField",
                },
              },
            }),
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
};
