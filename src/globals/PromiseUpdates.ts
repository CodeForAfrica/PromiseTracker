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
      name: "title",
      type: "text",
      required: true,
      localized: true,
      label: {
        en: "Title",
        fr: "Titre",
      },
    },
    {
      name: "description",
      type: "textarea",
      required: true,
      localized: true,
      label: {
        en: "Description",
        fr: "Description",
      },
    },
    {
      name: "questions",
      type: "array",
      localized: true,
      label: {
        en: "Questions",
        fr: "Questions",
      },
      labels: {
        singular: {
          en: "Question",
          fr: "Question",
        },
        plural: {
          en: "Questions",
          fr: "Questions",
        },
      },
      fields: [
        {
          name: "question",
          type: "text",
          required: true,
          label: {
            en: "Question",
            fr: "Question",
          },
        },
        {
          name: "description",
          type: "textarea",
          label: {
            en: "Helper Text",
            fr: "Texte d'aide",
          },
        },
        {
          name: "required",
          type: "checkbox",
          defaultValue: false,
          label: {
            en: "Required",
            fr: "Obligatoire",
          },
        },
        {
          name: "type",
          type: "select",
          required: true,
          defaultValue: "text",
          options: [
            {
              label: {
                en: "Text Answer",
                fr: "Réponse courte",
              },
              value: "text",
            },
            {
              label: {
                en: "File Upload",
                fr: "Téléchargement de fichier",
              },
              value: "upload",
            },
          ],
          label: {
            en: "Input Type",
            fr: "Type de champ",
          },
        },
      ],
    },
    {
      type: "row",
      fields: [
        {
          name: "submitButtonText",
          type: "text",
          required: true,
          localized: true,
          defaultValue: "Submit",
          label: {
            en: "Submit Button Text",
            fr: "Texte du bouton de soumission",
          },
          admin: {
            width: "33.3%",
          },
        },
        {
          name: "uploadDropLabel",
          type: "text",
          localized: true,
          required: true,
          defaultValue: "Drop file(s) here",
          label: {
            en: "Upload Drop Placeholder",
            fr: "Texte pour déposer les fichiers",
          },
          admin: {
            width: "33.3%",
          },
        },
        {
          name: "uploadBrowseLabel",
          type: "text",
          localized: true,
          required: true,
          defaultValue: "Click to select files to upload",
          label: {
            en: "Upload Button Label",
            fr: "Texte du bouton de téléversement",
          },
          admin: {
            width: "33.3%",
          },
        },
      ],
    },
  ],
};
