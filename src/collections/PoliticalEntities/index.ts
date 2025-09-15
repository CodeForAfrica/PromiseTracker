import { CollectionConfig } from "payload";

export const PoliticalEntities: CollectionConfig = {
  slug: "political-entities",
  labels: {
    singular: {
      en: "Political Entity",
      fr: "Entité politique",
    },
    plural: {
      en: "Political Entities",
      fr: "Entités politiques",
    },
  },
  admin: {
    useAsTitle: "name",
    group: {
      en: "Documents",
      fr: "Documents",
    },
  },
  fields: [
    {
      name: "name",
      type: "text",
      required: true,
      label: {
        en: "Name",
        fr: "Nom",
      },
    },
    {
      name: "region",
      type: "text",
      admin: {
        position: "sidebar",
      },
      label: {
        en: "Region",
        fr: "Région",
      },
    },
    {
      name: "position",
      type: "text",
      required: true,
      admin: {
        position: "sidebar",
        description: {
          en: "Title of the entity, i.e President, Governor, Prime Minister",
          fr: "Titre de l'entité, c'est-à-dire Président, Gouverneur, Premier ministre",
        },
      },
      label: {
        en: "Position",
        fr: "Position",
      },
    },
    {
      name: "image",
      type: "upload",
      relationTo: "media",
      required: true,
      admin: {
        description: {
          en: "Image of the Political Entity",
          fr: "Image de l'entité politique",
        },
      },
      label: {
        en: "Photo",
        fr: "Photo",
      },
    },
    {
      type: "row",
      fields: [
        {
          name: "periodFrom",
          type: "date",
          required: true,
          label: {
            en: "Term start date",
            fr: "Date de début du trimestre",
          },
        },
        {
          name: "periodTo",
          type: "date",
          required: true,
          label: {
            en: "Term end date",
            fr: "Date de fin de mandat",
          },
        },
      ],
    },
    {
      name: "airtableID",
      type: "text",
      admin: {
        position: "sidebar",
        readOnly: true,
      },
      label: "Airtable ID",
    },
  ],
};
