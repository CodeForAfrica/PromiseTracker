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
      name: "title",
      type: "text",
      admin: {
        hidden: true,
      },
    },
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
                {
                  name: "emptyListLabel",
                  type: "text",
                  required: true,
                  label: {
                    en: "Empty Tenant List Label",
                    fr: "Étiquette de liste de locataires vide",
                  },
                  defaultValue: "No tenants created yet",
                },
              ],
            },
          ],
        },
        {
          label: {
            en: "Entity Selector",
            fr: "Sélecteur d'entité",
          },
          fields: [
            {
              name: "entitySelector",
              type: "group",
              fields: [
                {
                  name: "emptyTitle",
                  type: "text",
                  required: true,
                  label: {
                    en: "Empty List Title",
                    fr: "Titre de la liste vide",
                  },
                  defaultValue:
                    "No political entities have been published yet for this tenant",
                },
                {
                  name: "EmptySubtitle",
                  type: "textarea",
                  required: true,
                  label: {
                    en: "Empty List Subtitle",
                    fr: "Sous-titre de la liste vide",
                  },
                  defaultValue:
                    "Check back soon for newly tracked leaders and their promises.",
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};
