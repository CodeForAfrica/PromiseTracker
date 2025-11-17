import { CollectionConfig } from "payload";
import { image } from "@/fields/image";
import { link } from "@/fields/link/link";

export const Partners: CollectionConfig = {
  slug: "partners",
  admin: {
    useAsTitle: "name",
  },
  access: {
    read: () => true,
  },
  labels: {
    singular: {
      en: "Partner",
      fr: "Partenaire",
    },
    plural: {
      en: "Partners",
      fr: "Partenaires",
    },
  },
  fields: [
    {
      name: "name",
      type: "text",
      required: true,
      label: {
        en: "Name",
        fr: "Nom",
      },
    },
    {
      name: "description",
      type: "richText",
      required: true,
      label: {
        en: "Description",
        fr: "Description",
      },
    },
    image({
      name: "image",
      label: {
        en: "Image",
        fr: "Image",
      },
      required: true,
    }),
    link({
      appearances: false,
      overrides: {
        name: "url",
        required: true,
        label: {
          en: "URL",
          fr: "URL",
        },
      },
    }),
  ],
};
