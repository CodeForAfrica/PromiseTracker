import type { CollectionConfig } from "payload";
import { authenticatedUsers } from "@/access/roles";
import { airtableID } from "@/fields/airtableID";
import {
  deleteAIExtractionExportRowsAfterDocumentDelete,
  queueAIExtractionExportRowsSyncAfterDocumentChange,
} from "./hooks";

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
  // Source documents carry internal processing data (extracted text, source
  // URLs, sync metadata) and are not public presentation content.
  access: {
    read: authenticatedUsers,
  },
  hooks: {
    afterChange: [queueAIExtractionExportRowsSyncAfterDocumentChange],
    afterDelete: [deleteAIExtractionExportRowsAfterDocumentDelete],
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
    airtableID(),
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
      // Explicit operator-reviewable state for documents the AI extraction
      // pipeline rejected (over size limits) or truncated (chunk/candidate
      // ceilings), or that failed terminally. Cleared by operators after
      // review; documents in this state are visible in admin filters.
      name: "extractionReview",
      type: "group",
      label: {
        en: "Extraction Review",
        fr: "Révision de l'extraction",
      },
      admin: {
        position: "sidebar",
      },
      fields: [
        {
          name: "status",
          type: "select",
          options: [
            { value: "rejected", label: { en: "Rejected", fr: "Rejeté" } },
            { value: "truncated", label: { en: "Truncated", fr: "Tronqué" } },
            { value: "failed", label: { en: "Failed", fr: "Échoué" } },
          ],
          label: {
            en: "Status",
            fr: "Statut",
          },
        },
        {
          name: "reason",
          type: "text",
          label: {
            en: "Reason",
            fr: "Raison",
          },
        },
        {
          name: "flaggedAt",
          type: "date",
          label: {
            en: "Flagged At",
            fr: "Signalé le",
          },
        },
      ],
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
