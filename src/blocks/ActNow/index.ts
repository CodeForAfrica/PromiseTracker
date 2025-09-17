import { image } from "@/fields/image";
import { link } from "@/fields/link/link";
import { Block } from "payload";

export const ActNow: Block = {
  slug: "act-now",
  interfaceName: "ActNowBlock",
  imageURL: "/cms/act-now.png",
  imageAltText: "Act Now",
  fields: [
    image({
      name: "logo",
      required: true,
    }),
    {
      name: "description",
      type: "textarea",
      required: true,
    },
    image({
      name: "image",
      required: true,
    }),
    link({
      appearances: false,
      overrides: {
        required: true,
      },
    }),
  ],
};
