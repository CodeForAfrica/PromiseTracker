import { Block } from "payload";

export const KeyPromises: Block = {
  slug: "key-promises",
  interfaceName: "KeyPromises",
  imageURL: "/cms/key-promises.png",
  imageAltText: "Key Promises",
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
      localized: true,
    },
    {
      name: "actionLabel",
      type: "text",
      label: {
        en: "CTA Label",
        fr: "Libellé du bouton",
      },
      localized: true,
    },
    {
      name: "itemsToShow",
      type: "number",
      required: true,
      label: {
        en: "Number of promises",
        fr: "Nombre de promesses",
      },
      defaultValue: 5,
      admin: {
        description: {
          en: "How many highlighted promises to display (minimum 1).",
          fr: "Nombre de promesses mises en avant à afficher (minimum 1).",
        },
        step: 1,
      },
      min: 1,
    },
  ],
};
