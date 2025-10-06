import { CollectionConfig } from "payload";
import { ensureUniqueSlug } from "./hooks/ensureUniqueSlug";
import Partners from "@/blocks/Partners";
import Newsletter from "@/blocks/Newsletter";
import LatestPromises from "@/blocks/LatestPromises";
import PromiseList from "@/blocks/PromiseList";
import { slugField } from "@/fields/slug";
import { KeyPromises } from "@/blocks/KeyPromises";
import { ActNow } from "@/blocks/ActNow";
import { Hero } from "@/blocks/Hero";
import PageHeader from "@/blocks/PageHeader";

export const Pages: CollectionConfig = {
  slug: "pages",
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
      admin: {
        components: {
          Cell: "@/components/payload/CollectionTenantFieldCell#CollectionTenantFieldCell",
        },
      },
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
        Hero,
        PageHeader,
        Newsletter,
        Partners,
        LatestPromises,
        PromiseList,
        KeyPromises,
      ],
    },
  ],
};
