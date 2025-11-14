import { ActNow } from "@/blocks/ActNow";
import { EntitySelection } from "@/blocks/EntitySelection";
import { EntityHero } from "@/blocks/Hero/EntityHero";
import Newsletter from "@/blocks/Newsletter";
import Partners from "@/blocks/Partners";
import { TenantSelection } from "@/blocks/TenantSelector";
import { EngagementTab } from "@/collections/SiteSettings/tabs/EngagementTab";
import { GeneralTab } from "@/collections/SiteSettings/tabs/GeneralTab";
import { NavigationTab } from "@/collections/SiteSettings/tabs/NavigationTab";
import { GlobalConfig } from "payload";

export const HomePage: GlobalConfig = {
  slug: "home-page",
  label: {
    en: "Home Page",
    fr: "Page d'accueil",
  },
  admin: {
    group: {
      en: "Website",
      fr: "Site web",
    },
  },
  fields: [
    {
      type: "tabs",
      required: true,
      tabs: [
        {
          label: {
            en: "Entity Selector",
            fr: "Sélecteur d'entité",
          },
          fields: [
            {
              name: "entitySelector",
              type: "group",
              label: "",
              fields: [
                {
                  localized: true,
                  type: "blocks",
                  name: "blocks",
                  required: true,
                  blocks: [
                    ActNow,
                    EntitySelection,
                    EntityHero,
                    Newsletter,
                    Partners,
                  ],
                },
              ],
            },
          ],
        },
        GeneralTab,
        NavigationTab,
        EngagementTab,
      ],
    },
  ],
};
