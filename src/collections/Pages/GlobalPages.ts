import { CollectionConfig } from "payload";
import { ensureUniqueSlug } from "./hooks/ensureUniqueSlug";
import Partners from "@/blocks/Partners";
import Newsletter from "@/blocks/Newsletter";
import { slugField } from "@/fields/slug";
import { ActNow } from "@/blocks/ActNow";
import PageHeader from "@/blocks/PageHeader";
import { FAQ } from "@/blocks/FAQ";
import { PartnerDetails } from "@/blocks/PartnerDetails";
import { TenantSelection } from "@/blocks/TenantSelector";

export const GlobalPages: CollectionConfig = {
  slug: "global-pages",
  admin: {
    group: { en: "Publication", fr: "Publication" },
    defaultColumns: ["title", "slug", "tenant"],
    useAsTitle: "title",
  },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
    },
    ...slugField("title", {
      slugOverrides: {
        index: true,
        required: true,
        admin: {
          position: "sidebar",
        },
        hooks: {
          beforeValidate: [ensureUniqueSlug],
        },
      },
    }),
    {
      name: "blocks",
      type: "blocks",
      blocks: [
        ActNow,
        FAQ,
        Newsletter,
        PageHeader,
        Partners,
        PartnerDetails,
        TenantSelection,
      ],
    },
  ],
};
