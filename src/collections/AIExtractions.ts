import { CollectionConfig } from "payload";

export const AIExtractions: CollectionConfig = {
  slug: "ai-extractions",
  labels: {
    singular: {
      en: "AI Extraction",
      fr: "Extraction IA",
    },
    plural: {
      en: "AI Extractions",
      fr: "Extractions IA",
    },
  },
  admin: {
    group: {
      en: "Documents",
      fr: "Documents",
    },
    useAsTitle: "title",
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: "title",
      type: "text",
      label: {
        en: "Title",
        fr: "Titre",
      },
    },
    {
      name: "document",
      type: "relationship",
      relationTo: "documents",
      required: true,
      hasMany: false,
      label: {
        en: "Document",
        fr: "Document",
      },
    },
    {
      name: "extractions",
      type: "array",
      label: {
        en: "AI Extractions",
        fr: "Extractions IA",
      },
      admin: {
        components: {
          RowLabel: {
            path: "@/components/payload/RowLabel#CustomRowLabel",
            clientProps: {
              fieldToUse: "summary",
            },
          },
        },
      },
      fields: [
        {
          name: "category",
          type: "text",
          required: true,
          label: {
            en: "Category",
            fr: "Catégorie",
          },
        },
        {
          name: "summary",
          type: "text",
          required: true,
          label: {
            en: "Summary",
            fr: "Résumé",
          },
        },
        {
          name: "source",
          type: "textarea",
          required: true,
          label: {
            en: "Source",
            fr: "Source",
          },
        },
        {
          type: "row",
          fields: [
            {
              name: "uniqueId",
              type: "text",
              admin: {
                hidden: true,
              },
              label: {
                en: "Unique ID",
                fr: "ID Unique",
              },
            },
            {
              name: "checkMediaId",
              type: "text",
              admin: {
                hidden: true,
              },
              label: {
                en: "Check Media ID",
                fr: "ID Check Media",
              },
            },
            {
              name: "checkMediaURL",
              label: {
                en: "CheckMedia URL",
                fr: "URL CheckMedia",
              },
              type: "text",
            },
            {
              name: "Status",
              type: "relationship",
              relationTo: "promise-status",
              label: {
                en: "Status",
                fr: "Statut",
              },
            },
          ],
        },
      ],
    },
  ],
};
