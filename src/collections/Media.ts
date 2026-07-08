import type { CollectionConfig } from "payload";
import { sha256Buffer } from "@/utils/files";

export const Media: CollectionConfig = {
  slug: "media",
  hooks: {
    beforeChange: [
      ({ data, req }) => {
        if (req.file?.data) {
          return { ...data, checksum: sha256Buffer(req.file.data) };
        }
        return data;
      },
    ],
  },
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
    {
      name: "checksum",
      type: "text",
      required: false,
      index: true,
      label: {
        en: "Checksum",
        fr: "Somme de contrôle",
      },
      admin: {
        hidden: true,
        readOnly: true,
        description: {
          en: "SHA-256 of the file contents, used to avoid duplicate downloads",
          fr: "SHA-256 du contenu du fichier, utilisé pour éviter les téléchargements en double",
        },
      },
    },
  ],
  upload: {
    staticDir: "media",
  },
};
