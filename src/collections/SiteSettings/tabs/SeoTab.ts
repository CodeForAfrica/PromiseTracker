import {
  MetaDescriptionField,
  MetaImageField,
  MetaTitleField,
  OverviewField,
  PreviewField,
} from "@payloadcms/plugin-seo/fields";
import { Tab } from "payload";

const SeoTab: Tab = {
  label: "SEO",
  fields: [
    {
      name: "meta",
      type: "group",
      fields: [
        MetaTitleField({
          hasGenerateFn: true,
        }),
        MetaDescriptionField({
          hasGenerateFn: true,
        }),
        MetaImageField({
          relationTo: "media",
          hasGenerateFn: true,
        }),
        PreviewField({
          hasGenerateFn: true,
          titlePath: "meta.title",
          descriptionPath: "meta.description",
        }),
        OverviewField({
          titlePath: "meta.title",
          descriptionPath: "meta.description",
          imagePath: "meta.image",
        }),
      ],
    },
  ],
};

export default SeoTab;
