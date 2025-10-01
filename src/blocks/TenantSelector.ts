import { Block } from "payload";

export const TenantSelection: Block = {
  slug: "tenant-selection",
  imageURL: "/cms/tenant-selector.png",
  imageAltText: "Tenant Selector",
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
      defaultValue: "Choose a country to view their tracked promises.",
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
};
