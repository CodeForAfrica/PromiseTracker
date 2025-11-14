import { Block } from "payload";

export const FAQ: Block = {
  slug: "faq",
  interfaceName: "FAQBlock",
  imageURL: "/cms/faq.png",
  imageAltText: "FAQ",
  labels: {
    singular: "FAQS",
    plural: "FAQS",
  },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
      localized: true,
    },
    {
      name: "faqs",
      type: "array",
      required: true,
      localized: true,
      minRows: 1,
      admin: {
        components: {
          RowLabel: {
            path: "@/components/payload/RowLabel#CustomRowLabel",
            clientProps: {
              fieldToUse: "question",
            },
          },
        },
      },
      fields: [
        {
          name: "question",
          type: "text",
          required: true,
          localized: true,
        },
        {
          name: "answer",
          type: "richText",
          required: true,
          localized: true,
        },
      ],
    },
  ],
};
