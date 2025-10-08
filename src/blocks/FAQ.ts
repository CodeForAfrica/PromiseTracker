import { Block } from "payload";

export const FAQ: Block = {
  slug: "faq",
  imageURL: "/cms/faq.png",
  imageAltText: "FAQ",
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
    },
    {
      name: "faqs",
      type: "array",
      required: true,
      fields: [
        {
          name: "question",
          type: "text",
          required: true,
        },
        {
          name: "answer",
          type: "text",
          required: true,
        },
      ],
    },
  ],
};
