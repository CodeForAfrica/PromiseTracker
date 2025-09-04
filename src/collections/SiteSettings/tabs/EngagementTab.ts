import socialLinks from "@/fields/socialLinks";
import { Tab } from "payload";

export const EngagementTab: Tab = {
  label: {
    en: "Engagement",
    fr: "Fiançailles",
  },
  fields: [
    {
      name: "connect",
      type: "group",
      label: "Social Accounts",
      localized: true,
      fields: [
        {
          type: "collapsible",
          label: "Title & Links",
          fields: [
            {
              name: "title",
              type: "text",
              admin: {
                description:
                  "Text that appears on contact links e.g Stay in Touch",
              },
              required: true,
            },
            socialLinks(),
          ],
        },
      ],
    },
  ],
};
