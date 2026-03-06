import { GlobalConfig } from "payload";
import { AITab } from "./tabs/AITab";
import { AirtableTab } from "./tabs/AirtableTab";
import { MeedanTab } from "./tabs/MeedanTab";

export const Settings: GlobalConfig = {
  slug: "settings",
  label: {
    en: "Settings",
    fr: "Paramètres",
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
  },
  admin: {
    group: {
      en: "Settings",
      fr: "Paramètres",
    },
  },
  fields: [
    {
      type: "tabs",
      label: {
        en: "Airtable",
        fr: "Airtable",
      },
      tabs: [AirtableTab, AITab, MeedanTab],
    },
  ],
};
