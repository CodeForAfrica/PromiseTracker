import { socialLinks } from "@/fields/socialLinks";
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
      label: {
        en: "Social Accounts",
        fr: "Comptes sociaux",
      },
      fields: [
        {
          type: "collapsible",
          label: {
            en: "Title & Links",
            fr: "Titre et liens",
          },
          fields: [
            {
              name: "title",
              type: "text",
              required: true,
              label: {
                en: "Title",
                fr: "Titre",
              },
              admin: {
                description: {
                  en: "Text that appears on contact links e.g Stay in Touch",
                  fr: "Texte qui apparaît sur les liens de contact, par exemple «Restez en contact»",
                },
              },
            },
            socialLinks(),
          ],
        },
      ],
    },
  ],
};
