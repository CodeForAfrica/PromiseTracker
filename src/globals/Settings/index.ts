import { GlobalConfig } from "payload";
import { AITab } from "./tabs/AITab";
import { AirtableTab } from "./tabs/AirtableTab";
import { MeedanTab } from "./tabs/MeedanTab";
import { superAdmins } from "@/access/roles";

export const Settings: GlobalConfig = {
  slug: "settings",
  label: {
    en: "Settings",
    fr: "Paramètres",
  },
  access: {
    read: superAdmins,
    update: superAdmins,
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
