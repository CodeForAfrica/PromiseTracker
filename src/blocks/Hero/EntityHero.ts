import { Block } from "payload";
import { colorPickerField } from "@innovixx/payload-color-picker-field";

export const EntityHero: Block = {
  slug: "entity-hero",
  imageURL: "/cms/entity-hero.png",
  interfaceName: "EntityHeroBlock",
  imageAltText: "Entity Hero",
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
      localized: true,
    },
    {
      name: "description",
      type: "textarea",
      required: true,
      localized: true,
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
          en: "Select promise statuses to highlight in lists and hero sections.",
          fr: "Sélectionnez les statuts de promesse à mettre en avant dans les listes et les sections hero.",
        },
      },
      fields: [
        {
          name: "title",
          type: "text",
          required: true,
          label: {
            en: "Group title",
            fr: "Titre du groupe",
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
