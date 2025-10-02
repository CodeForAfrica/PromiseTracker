import type { CollectionConfig } from "payload";

export const Media: CollectionConfig = {
  slug: "media",
  labels: {
    singular: {
      en: "Media",
      fr: "Médias",
    },
    plural: {
      en: "Media",
      fr: "Médias",
    },
  },
  admin: {
    group: { en: "Publication", fr: "Publication" },
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: "alt",
      type: "text",
      required: true,
      label: {
        en: "Alt",
        fr: "Alt",
      },
    },
    {
      name: "externalUrl",
      type: "text",
      required: false,
      label: {
        en: "Source URL",
        fr: "URL source",
      },
      admin: {
        description: {
          en: "Original source URL for synced media",
          fr: "URL source d'origine pour les médias synchronisés",
        },
      },
    },
  ],
  upload: {
    staticDir: "media",
  },
};
