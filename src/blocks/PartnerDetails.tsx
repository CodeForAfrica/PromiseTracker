import { Block } from "payload";

export const PartnerDetails: Block = {
  slug: "partner-details",
  imageURL: "/cms/partner-details.png",
  imageAltText: "Partner Details",
  interfaceName: "PartnerDetailsBlock",
  labels: {
    singular: {
      en: "Partner Details",
      fr: "Détails des partenaires",
    },
    plural: {
      en: "Partner Details",
      fr: "Détails des partenaires",
    },
  },
  fields: [
    {
      name: "partners",
      type: "relationship",
      relationTo: "partners",
      hasMany: true,
      required: true,
    },
  ],
};
