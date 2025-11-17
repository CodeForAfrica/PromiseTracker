import { ActNow } from "@/blocks/ActNow";
import { EntitySelection } from "@/blocks/EntitySelection";
import { EntityHero } from "@/blocks/Hero/EntityHero";
import Newsletter from "@/blocks/Newsletter";
import Partners from "@/blocks/Partners";
import { NavigationTab } from "@/collections/SiteSettings/tabs/NavigationTab";
import { GlobalConfig } from "payload";

export const EntityPage: GlobalConfig = {
  slug: "entity-page",
  label: {
    en: "Entity Page",
    fr: "Page d'entité",
  },
  admin: {
    group: {
      en: "Publication",
      fr: "Publication",
    },
  },
  fields: [
    {
      name: "entitySelector",
      type: "group",
      label: "",
      fields: [
        {
          type: "blocks",
          name: "blocks",
          required: true,
          blocks: [ActNow, EntitySelection, EntityHero, Newsletter, Partners],
        },
      ],
    },
    {
      type: "tabs",
      tabs: [NavigationTab],
    },
  ],
};
