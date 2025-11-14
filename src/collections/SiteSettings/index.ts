import { CollectionConfig } from "payload";
import { GeneralTab } from "./tabs/GeneralTab";
import { NavigationTab } from "./tabs/NavigationTab";
import { EngagementTab } from "./tabs/EngagementTab";
import SeoTab from "./tabs/SeoTab";

export const SiteSettings: CollectionConfig = {
  slug: "site-settings",
  labels: {
    singular: {
      en: "Tenant Site Settings",
      fr: "Paramètres du site locataire",
    },
    plural: {
      en: "Tenant Site Settings",
      fr: "Paramètres du site locataire",
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
      tabs: [GeneralTab, NavigationTab, EngagementTab, SeoTab],
    },
  ],
};
