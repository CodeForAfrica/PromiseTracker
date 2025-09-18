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
              admin: {
                hideGutter: true,
              },
              fields: [
                {
                  name: "title",
                  type: "text",
                  required: true,
                  label: {
                    en: "Section title",
                    fr: "Titre de la section",
                  },
                  defaultValue: "Select Tenant",
                },
                {
                  name: "subtitle",
                  type: "textarea",
                  required: true,
                  label: {
                    en: "Section description",
                    fr: "Description de la section",
                  },
                  defaultValue:
                    "Choose a country to view their tracked promises.",
                },
                {
                  name: "ctaLabel",
                  required: true,
                  type: "text",
                  label: {
                    en: "CTA label",
                    fr: "Libellé du CTA",
                  },
                  defaultValue: "Open tenant site",
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};
