import { image } from "@/fields/image";
import { Block } from "payload";

export const PageHeader: Block = {
  slug: "page-header",
  interfaceName: "PageHeaderBlock",
  imageURL: "/cms/page-header.png",
  labels: {
    singular: {
      en: "Page Header",
      fr: "En-tête de page",
    },
    plural: {
      en: "Page Headers",
      fr: "En-têtes de page",
    },
  },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
      localized: true,
      label: {
        en: "Title",
        fr: "Titre",
      },
    },
    {
      name: "description",
      type: "richText",
      required: true,
      localized: true,
      label: {
        en: "Description",
        fr: "Description",
      },
    },
    image({
      name: "image",
      required: true,
      localized: true,
      label: {
        en: "Image",
        fr: "Image",
      },
    }),
  ],
};

export default PageHeader;
