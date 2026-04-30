import { deleteAIExtractionExportRowsForAIExtraction } from "@/lib/aiExtractionExportRows";
import { CollectionConfig } from "payload";

const exportRowSyncQueue = process.env.PAYLOAD_JOBS_QUEUE || "everyMinute";

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
  hooks: {
    afterChange: [
      async ({ doc, req }) => {
        try {
          await req.payload.jobs.queue({
            input: {
              aiExtractionId: String(doc.id),
              scope: "aiExtraction",
            },
            overrideAccess: true,
            queue: exportRowSyncQueue,
            req,
            task: "syncAIExtractionExportRows",
          });
        } catch (err) {
          req.payload.logger.error({
            aiExtractionId: String(doc.id),
            err,
            msg: "Failed to queue AI extraction export row sync after AI extraction change",
          });
        }
        return doc;
      },
    ],
    afterDelete: [
      async ({ doc, req }) => {
        try {
          await deleteAIExtractionExportRowsForAIExtraction({
            aiExtractionId: String(doc.id),
            payload: req.payload,
            req,
          });
        } catch (err) {
          req.payload.logger.error({
            aiExtractionId: String(doc.id),
            err,
            msg: "Failed to delete AI extraction export rows after AI extraction delete",
          });
        }
        return doc;
      },
    ],
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
              admin: {
                width: "50%",
              },
            },
            {
              name: "Status",
              type: "relationship",
              relationTo: "promise-status",
              label: {
                en: "Status",
                fr: "Statut",
              },
              admin: {
                width: "50%",
              },
            },
            {
              name: "uploadError",
              type: "text",
              admin: {
                readOnly: true,
                description: {
                  en: "Set when the upload to Meedan fails permanently. Extractions with this field set will not be retried.",
                  fr: "Défini lorsque le téléchargement vers Meedan échoue définitivement. Les extractions avec ce champ ne seront pas réessayées.",
                },
              },
              label: {
                en: "Upload Error",
                fr: "Erreur d'upload",
              },
            },
          ],
        },
      ],
    },
  ],
};
