import { Block } from "payload";
import { colorPickerField } from "@innovixx/payload-color-picker-field";

export const EntitySelection: Block = {
  slug: "entity-selection",
  imageURL: "/cms/entity-selection.png",
  imageAltText: "Entity Selection",
  interfaceName: "EntitySelectionBlock",
  labels: {
    singular: {
      en: "Entity Selection",
      fr: "Sélection d'entité",
    },
    plural: {
      en: "Entity Selections",
      fr: "Sélections d'entités",
    },
  },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
      defaultValue: "Select an entity to view their promises",
      localized: true,
    },
    {
      name: "emptyTitle",
      type: "text",
      required: true,
      localized: true,
      label: {
        en: "Empty List Title",
        fr: "Titre de la liste vide",
      },
      defaultValue:
        "No political entities have been published yet for this tenant",
    },
    {
      name: "EmptySubtitle",
      type: "textarea",
      required: true,
      localized: true,
      label: {
        en: "Empty List Subtitle",
        fr: "Sous-titre de la liste vide",
      },
      defaultValue:
        "Check back soon for newly tracked leaders and their promises.",
    },
    {
      name: "statusGroups",
      type: "array",
      minRows: 0,
      maxRows: 3,
      label: {
        en: "Promise Status Groups",
        fr: "Groupes de statuts de promesse",
      },
      admin: {
        description: {
          en: "Select promise statuses to highlight in entity lists and hero sections.",
          fr: "Sélectionnez les statuts de promesse à mettre en avant dans les listes d'entités et les sections hero.",
        },
      },
      fields: [
        {
          name: "title",
          type: "text",
          required: true,
          localized: true,
          label: {
            en: "Group title",
            fr: "Titre du groupe",
          },
        },
        {
          name: "description",
          type: "textarea",
          required: true,
          localized: true,
          label: {
            en: "Group description",
            fr: "Description du groupe",
          },
        },
        colorPickerField({
          name: "color",
          label: {
            en: "Display color",
            fr: "Couleur d'affichage",
          },
          required: true,
          defaultValue: "#000000",
        }),
        {
          name: "statuses",
          type: "relationship",
          relationTo: "promise-status",
          hasMany: true,
          required: true,
          label: {
            en: "Statuses",
            fr: "Statuts",
          },
        },
      ],
    },
  ],
};
