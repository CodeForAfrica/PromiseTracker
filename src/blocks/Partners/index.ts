import { Block } from "payload";

const Partners: Block = {
  slug: "partners",
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
