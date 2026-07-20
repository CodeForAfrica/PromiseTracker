import { GlobalConfig } from "payload";

import {
  validateUpdateEmbedCodeField,
  validateUpdateFormUrlField,
} from "@/lib/embeds/validation";

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
      name: "formUrl",
      type: "text",
      localized: true,
      validate: (value: string | null | undefined) =>
        validateUpdateFormUrlField(value),
      admin: {
        description: {
          en: "Preferred. The https URL of the Airtable shared form, e.g. https://airtable.com/embed/app…/shr…. Only approved embed providers are accepted.",
          fr: "Recommandé. L'URL https du formulaire partagé Airtable, p. ex. https://airtable.com/embed/app…/shr…. Seuls les fournisseurs d'intégration approuvés sont acceptés.",
        },
      },
      label: {
        en: "Update Form URL",
        fr: "URL du formulaire de mise à jour",
      },
    },
    {
      name: "embedCode",
      type: "code",
      localized: true,
      validate: (
        value: string | null | undefined,
        { siblingData }: { siblingData: Partial<{ formUrl?: string | null }> },
      ) => validateUpdateEmbedCodeField(value, siblingData?.formUrl),
      admin: {
        language: "html",
        description: {
          en: "Legacy. Paste the Airtable iframe embed snippet. The iframe src must be on an approved embed provider; scripts are rejected. Prefer the Update Form URL field above.",
          fr: "Hérité. Collez le code d'intégration iframe Airtable. La source de l'iframe doit provenir d'un fournisseur approuvé ; les scripts sont rejetés. Préférez le champ URL du formulaire ci-dessus.",
        },
      },
      label: {
        en: "Airtable Embed Code (legacy)",
        fr: "Code d'intégration Airtable (hérité)",
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
