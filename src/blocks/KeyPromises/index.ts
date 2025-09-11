import { Block } from "payload";

export const KeyPromises: Block = {
  slug: "key-promises",
  interfaceName: "KeyPromises",
  imageURL: "/blocks/key-promises.png",
  imageAltText: "Key Promises",
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
      localized: true,
    },
  ],
};
