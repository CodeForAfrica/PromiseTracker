import { CollectionConfig } from "payload";

export const Documents: CollectionConfig = {
  slug: "documents",
  labels: {
    singular: {
      en: "Document",
      fr: "Document",
    },
    plural: {
      en: "Documents",
      fr: "Documents",
    },
  },
  access: {
    read: () => true,
  },
  admin: {
    defaultColumns: ["title", "politicalEntity", "language", "type"],
    useAsTitle: "title",
    group: {
      en: "Documents",
      fr: "Documents",
    },
  },
  fields: [
    {
      name: "title",
      label: {
        en: "Title",
        fr: "Titre",
      },
      type: "text",
      required: true,
    },
    {
      name: "url",
      type: "text",
      label: {
        en: "URL",
        fr: "URL",
      },
    },
    {
      name: "docURLs", // only used to download file from airtable
      type: "array",
      admin: {
        hidden: true,
      },
      fields: [
        {
          type: "text",
          name: "url",
          required: true,
        },
      ],
    },
    {
      name: "files",
      type: "upload",
      relationTo: "media",
      hasMany: true,
      label: {
        en: "Files",
        fr: "Fichiers",
      },
    },
    {
      name: "politicalEntity",
      type: "relationship",
      relationTo: "political-entities",
      label: {
        en: "Political Entity",
        fr: "Entité Politique",
      },
      admin: {
        position: "sidebar",
      },
    },
    {
      name: "language",
      type: "select",
      label: {
        en: "Language",
        fr: "Langue",
      },
      admin: {
        position: "sidebar",
      },
      options: [
        {
          value: "en",
          label: {
            en: "English",
            fr: "Anglais",
          },
        },
        {
          value: "fr",
          label: {
            en: "French",
            fr: "Français",
          },
        },
      ],
    },
    {
      name: "type",
      type: "select",
      label: {
        en: "Type",
        fr: "Taper",
      },
      admin: {
        position: "sidebar",
      },
      options: [
        {
          value: "promise",
          label: {
            en: "Promise",
            fr: "Promesse",
          },
        },
        {
          value: "evidence",
          label: {
            en: "Evidence",
            fr: "Preuve",
          },
        },
      ],
    },
    {
      name: "airtableID",
      label: {
        en: "Airtable ID",
        fr: "ID Airtable ",
      },
      type: "text",
      unique: true,
      admin: {
        position: "sidebar",
        readOnly: true,
      },
    },
    {
      name: "fullyProcessed",
      type: "checkbox",
      label: {
        en: "Processed",
        fr: "Traité",
      },
      defaultValue: false,
      admin: {
        position: "sidebar",
      },
    },
    {
      type: "tabs",
      admin: {
        readOnly: true,
      },
      tabs: [
        {
          label: {
            en: "Extracted Text",
            fr: "Texte extrait",
          },
          fields: [
            {
              name: "extractedText",
              label: {
                en: "Text",
                fr: "Texte",
              },
              type: "array",
              fields: [
                {
                  name: "text",
                  label: {
                    en: "Text",
                    fr: "Texte",
                  },
                  type: "richText",
                  admin: {
                    readOnly: true,
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};
