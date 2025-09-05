import { image } from "@/fields/image";
import { linkGroup } from "@/fields/link/linkGroup";
import { Tab } from "payload";

export const GeneralTab: Tab = {
  label: {
    en: "General",
    fr: "Général",
  },
  fields: [
    {
      type: "collapsible",
      label: {
        en: "Title & Description",
        fr: "Titre et description",
      },
      fields: [
        {
          name: "title",
          type: "text",
          required: true,
        },
        {
          name: "description",
          type: "richText",
          required: true,
        },
      ],
    },
    {
      type: "collapsible",
      label: {
        en: "Logo",
        fr: "Logo",
      },
      fields: [
        image({
          name: "primaryLogo",
          label: {
            en: "Primary Logo",
            fr: "Logo principal",
          },
          required: true,
          admin: {
            description: {
              en: "Shown on main navigation bar.",
              fr: "Affiché sur la barre de navigation principale.",
            },
          },
        }),
        image({
          name: "secondaryLogo",
          required: true,
          label: {
            en: "Secondary Logo",
            fr: "Logo secondaire",
          },
          admin: {
            description: {
              en: "Shown on main footer. If not provided, primary logo will be reused.",
              fr: "Affiché dans le pied de page principal. S'il n'est pas fourni, le logo principal sera réutilisé.",
            },
          },
        }),
      ],
    },
    {
      type: "collapsible",
      label: {
        en: "Legal",
        fr: "Légal",
      },
      fields: [
        {
          name: "legal",
          type: "group",
          fields: [
            {
              name: "copyright",
              type: "text",
              label: {
                en: "Copyright",
                fr: "Droit d'auteur",
              },
              defaultValue: "PromiseTracker",
              admin: {
                position: "sidebar",
              },
            },
            linkGroup({
              overrides: {
                admin: {
                  description: {
                    en: "Links to legal information, for example, terms of service or privacy policy",
                    fr: "Liens vers des informations juridiques, par exemple, les conditions de service ou la politique de confidentialité",
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
};
