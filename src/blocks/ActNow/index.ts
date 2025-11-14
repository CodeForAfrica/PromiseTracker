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
      localized: true,
    }),
    {
      name: "description",
      type: "textarea",
      required: true,
      localized: true,
    },
    image({
      name: "image",
      required: true,
      localized: true,
    }),
    link({
      appearances: false,
      overrides: {
        required: true,
        localized: true,
      },
    }),
  ],
};
