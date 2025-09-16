import { CollectionConfig } from "payload";
import { colorPickerField } from "@innovixx/payload-color-picker-field";

export const PromiseStatus: CollectionConfig = {
  slug: "promise-status",
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
