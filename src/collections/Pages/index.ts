import { TestBlock } from "@/blocks/TestBlock";
import { CollectionConfig } from "payload";
import { ensureUniqueSlug } from "./hooks/ensureUniqueSlug";
import { OtherBlock } from "@/blocks/OtherBlock";
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
      blocks: [TestBlock, OtherBlock],
    },
  ],
};
