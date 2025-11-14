import { linkGroup } from "@/fields/link/linkGroup";
import { Tab } from "payload";

export const NavigationTab: Tab = {
  label: {
    en: "Navigation",
    fr: "Navigation",
  },
  fields: [
    {
      name: "primaryNavigation",
      type: "group",
      fields: [
        {
          type: "collapsible",
          label: {
            en: "Title & Links",
            fr: "Titre et liens",
          },
          fields: [
            {
              name: "titles",
              type: "text",
              localized: true,
            },
            linkGroup({
              overrides: {
                localized: true,
                name: "menus",
                labels: {
                  singular: {
                    en: "Menu",
                    fr: "Menus",
                  },
                  plural: {
                    en: "Menus",
                    fr: "Menus",
                  },
                },
              },
              appearances: false,
            }),
          ],
        },
      ],
    },
    {
      name: "secondaryNavigationList",
      type: "array",
      fields: [
        {
          name: "secondaryNavigation",
          type: "group",
          fields: [
            {
              type: "collapsible",
              label: {
                en: "Title & Links",
                fr: "Titre et liens",
              },
              fields: [
                {
                  name: "titles",
                  type: "text",
                  localized: true,
                },
                linkGroup({
                  overrides: {
                    name: "menus",
                    localized: true,
                    labels: {
                      singular: {
                        en: "Menu",
                        fr: "Menus",
                      },
                      plural: {
                        en: "Menus",
                        fr: "Menus",
                      },
                    },
                  },
                  appearances: false,
                }),
              ],
            },
          ],
        },
      ],
    },
  ],
};
