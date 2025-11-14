import { GlobalConfig } from "payload";

import { EngagementTab } from "@/collections/SiteSettings/tabs/EngagementTab";
import { GeneralTab } from "@/collections/SiteSettings/tabs/GeneralTab";
import { NavigationTab } from "@/collections/SiteSettings/tabs/NavigationTab";
import SeoTab from "@/collections/SiteSettings/tabs/SeoTab";

export const GlobalSiteSettings: GlobalConfig = {
  slug: "global-site-settings",
  label: {
    en: "Global Site Settings",
    fr: "Paramètres globaux du site",
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
      tabs: [GeneralTab, NavigationTab, EngagementTab, SeoTab],
    },
  ],
};
