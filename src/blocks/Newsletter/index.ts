import { image } from "@/fields/image";
import { Block } from "payload";

export const Newsletter: Block = {
  slug: "newsletter",
  imageURL: "/cms/newsletter.png",
  interfaceName: "NewsletterBlock",
  labels: {
    singular: "Newsletter",
    plural: "Newsletters",
  },
  fields: [
    image({
      name: "image",
      label: {
        en: "Image",
        fr: "Image",
      },
      required: true,
    }),
  ],
};

export default Newsletter;
