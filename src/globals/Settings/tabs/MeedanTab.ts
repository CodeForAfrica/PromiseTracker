import type { Tab } from "payload";
import { encryptedSecretField } from "@/fields/encryptedSecret";

export const MeedanTab: Tab = {
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
            encryptedSecretField({
              name: "meedanAPIKey",
              required: true,
              label: {
                en: "Meedan API Key",
                fr: "Clé API Meedan",
              },
              admin: {
                components: {
                  Field:
                    "@/globals/Settings/tabs/MaskedApiKeyField#MaskedApiKeyField",
                },
              },
            }),
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
};
