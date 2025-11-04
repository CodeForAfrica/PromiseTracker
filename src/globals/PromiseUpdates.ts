import { GlobalConfig } from "payload";

export const PromiseUpdates: GlobalConfig = {
  slug: "promise-updates",
  label: {
    en: "Promise Updates",
    fr: "Mises à jour des promesses",
  },
  admin: {
    group: {
      en: "Website",
      fr: "Site web",
    },
  },
  fields: [
    {
      name: "embedCode",
      type: "code",
      required: true,
      admin: {
        language: "html",
        description: {
          en: "Paste the Airtable embed snippet that should appear inside the update dialog.",
          fr: "Collez le code d'intégration Airtable à afficher dans la boîte de dialogue de mise à jour.",
        },
      },
      label: {
        en: "Airtable Embed Code",
        fr: "Code d'intégration Airtable",
      },
    },
  ],
};
