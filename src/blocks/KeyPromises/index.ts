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
  ],
};
