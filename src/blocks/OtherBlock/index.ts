import { Block } from "payload";

//TODO: (@kelvinkipruto):Delete this block: Only for Testing

export const OtherBlock: Block = {
  slug: "other-block",
  interfaceName: "OtherBlock",
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
    },
    {
      name: "content",
      type: "textarea",
      required: true,
    },
  ],
};
