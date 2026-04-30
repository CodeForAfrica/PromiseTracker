import { CollectionConfig } from "payload";
import { colorPickerField } from "@innovixx/payload-color-picker-field";

const exportRowSyncQueue = process.env.PAYLOAD_JOBS_QUEUE || "everyMinute";

export const PromiseStatus: CollectionConfig = {
  slug: "promise-status",
  hooks: {
    afterChange: [
      async ({ doc, req }) => {
        try {
          await req.payload.jobs.queue({
            input: {
              scope: "status",
              statusId: String(doc.id),
            },
            overrideAccess: true,
            queue: exportRowSyncQueue,
            req,
            task: "syncAIExtractionExportRows",
          });
        } catch (err) {
          req.payload.logger.error({
            err,
            msg: "Failed to queue AI extraction export row sync after promise status change",
            statusId: String(doc.id),
          });
        }
        return doc;
      },
    ],
    afterDelete: [
      async ({ doc, req }) => {
        try {
          await req.payload.jobs.queue({
            input: {
              scope: "status",
              statusId: String(doc.id),
            },
            overrideAccess: true,
            queue: exportRowSyncQueue,
            req,
            task: "syncAIExtractionExportRows",
          });
        } catch (err) {
          req.payload.logger.error({
            err,
            msg: "Failed to queue AI extraction export row sync after promise status delete",
            statusId: String(doc.id),
          });
        }
        return doc;
      },
    ],
  },
  admin: {
    group: {
      en: "Documents",
      fr: "Documents",
    },
    description: {
      en: "Status from CheckMedia",
      fr: "Statut de CheckMedia",
    },
    defaultColumns: ["label", "description", "colors.color"],
    useAsTitle: "label",
  },
  labels: {
    singular: {
      en: "Promise Status",
      fr: "Statut de la promesse",
    },
    plural: {
      en: "Promise Statuses",
      fr: "Statuts de promesse",
    },
  },
  fields: [
    {
      type: "row",
      admin: {
        readOnly: true,
      },
      fields: [
        {
          name: "label",
          type: "text",
          required: true,
          label: {
            en: "Label",
            fr: "Étiquette",
          },
          localized: true,
        },
        {
          name: "meedanId",
          type: "text",
          required: true,
          unique: true,
          label: "Meedan ID",
        },
      ],
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
      name: "colors",
      type: "group",
      fields: [
        {
          type: "row",
          fields: [
            colorPickerField({
              name: "color",
              label: {
                en: "Color",
                fr: "Couleur",
              },
              admin: {
                readOnly: true,
              },
            }),
            colorPickerField({
              name: "textColor",
              label: {
                en: "Text Color",
                fr: "Couleur du texte",
              },
              defaultValue: "#ffffff",
            }),
          ],
        },
      ],
    },
  ],
};
