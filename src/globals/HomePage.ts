import { ActNow } from "@/blocks/ActNow";
import { EntitySelection } from "@/blocks/EntitySelection";
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
            en: "Tenant Selector",
            fr: "Sélecteur de locataire",
          },
          fields: [
            {
              name: "tenantSelector",
              type: "group",
              label: "",
              required: true,
              admin: {
                hideGutter: true,
              },
              fields: [
                {
                  name: "blocks",
                  type: "blocks",
                  required: true,
                  blocks: [ActNow, TenantSelection, Newsletter, Partners],
                },
              ],
            },
          ],
        },
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
                  type: "blocks",
                  name: "blocks",
                  required: true,
                  blocks: [ActNow, EntitySelection, Newsletter, Partners],
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
