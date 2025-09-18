import { CollectionConfig } from "payload";
import { GeneralTab } from "./tabs/GeneralTab";
import { NavigationTab } from "./tabs/NavigationTab";
import { EngagementTab } from "./tabs/EngagementTab";

export const SiteSettings: CollectionConfig = {
  slug: "site-settings",
  labels: {
    singular: {
      en: "Site Settings",
      fr: "Paramètres du site",
    },
    plural: {
      en: "Site Settings",
      fr: "Paramètres du site",
    },
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
      tabs: [GeneralTab, NavigationTab, EngagementTab],
    },
  ],
};
