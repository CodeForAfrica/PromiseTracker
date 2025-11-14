import { Block } from "payload";

const Partners: Block = {
  slug: "partners",
  imageURL: "/cms/partners.png",
  interfaceName: "PartnersBlock",
  labels: {
    singular: "Partners",
    plural: "Partners",
  },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
      localized: true,
    },
    {
      name: "partners",
      type: "relationship",
      relationTo: "partners",
      hasMany: true,
    },
  ],
};

export default Partners;
