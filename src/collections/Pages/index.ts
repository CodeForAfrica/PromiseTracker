import { TestBlock } from "@/blocks/TestBlock";
import { CollectionConfig } from "payload";
import { ensureUniqueSlug } from "./hooks/ensureUniqueSlug";
import { OtherBlock } from "@/blocks/OtherBlock";
import Partners from "@/blocks/Partners";
import Newsletter from "@/blocks/Newsletter";
import { slugField } from "@/fields/slug";

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
      blocks: [TestBlock, OtherBlock, Partners, Newsletter],
    },
  ],
};
