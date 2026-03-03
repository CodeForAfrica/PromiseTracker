import type { Tab } from "payload";

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
};
