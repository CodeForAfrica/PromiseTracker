import { airtableID } from "@/fields/airtableID";
import { image } from "@/fields/image";
import { slugField } from "@/fields/slug";
import { CollectionConfig } from "payload";
import { ensureUniqueSlug } from "./hooks/ensureUniqueSlug";

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
    defaultColumns: [
      "name",
      "image",
      "region",
      "position",
      "periodFrom",
      "periodTo",
    ],
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
    ...slugField("name", {
      slugOverrides: {
        index: true,
        required: true,
        admin: {
          position: "sidebar",
        },
        hooks: {
          beforeValidate: [ensureUniqueSlug],
        },
      },
    }),
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
    image({
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
      required: true,
    }),
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
    airtableID(),
  ],
};
