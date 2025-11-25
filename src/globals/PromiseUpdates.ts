import { GlobalConfig } from "payload";

export const PromiseUpdates: GlobalConfig = {
  slug: "promise-updates",
  label: {
    en: "Promise Settings",
    fr: "Paramètres des mises à jour des promesses",
  },
  admin: {
    group: {
      en: "Website",
      fr: "Site web",
    },
  },
  fields: [
    {
      name: "defaultImage",
      type: "upload",
      relationTo: "media",
      required: true,
      label: {
        en: "Default Image",
        fr: "Image par défaut",
      },
      admin: {
        description: {
          en: "The default image that should be used for a promise.",
          fr: "L'image par défaut qui doit être utilisée pour une promesse.",
        },
      },
    },
    {
      name: "embedCode",
      type: "code",
      required: true,
      localized: true,
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
    {
      name: "updateLabel",
      type: "text",
      required: true,
      localized: true,
      defaultValue: "Update Promise",
      label: {
        en: "Update Promise Label",
        fr: "Libellé de mise à jour de promesse",
      },
      admin: {
        description: {
          en: "The label that should appear on the update dialog trigger button.",
          fr: "Le libellé qui doit apparaître sur le bouton de déclenchement de la boîte de dialogue de mise à jour.",
        },
      },
    },
  ],
};
