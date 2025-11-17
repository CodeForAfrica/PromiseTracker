import { CollectionConfig } from "payload";
import { image as imageField } from "@/fields/image";

export const Promises: CollectionConfig = {
  slug: "promises",
  labels: {
    singular: {
      en: "Promise",
      fr: "Promesse",
    },
    plural: {
      en: "Promises",
      fr: "Promesses",
    },
  },
  admin: {
    group: {
      en: "Documents",
      fr: "Documents",
    },
    useAsTitle: "title",
    defaultColumns: ["title", "status", "politicalEntity", "url"],
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: "meedanId",
      type: "text",
      required: true,
      unique: true,
      label: {
        en: "Meedan ID",
        fr: "ID Meedan",
      },
      admin: {
        hidden: true,
      },
    },
    {
      name: "title",
      type: "text",
      label: {
        en: "Title",
        fr: "Titre",
      },
    },
    {
      name: "description",
      type: "textarea",
      label: {
        en: "Description",
        fr: "Description",
      },
    },
    {
      name: "url",
      type: "text",
      label: {
        en: "URL",
        fr: "URL",
      },
    },
    {
      name: "status",
      type: "relationship",
      relationTo: "promise-status",
      label: {
        en: "Status",
        fr: "Statut",
      },
      admin: {
        position: "sidebar",
      },
    },
    {
      name: "politicalEntity",
      type: "relationship",
      relationTo: "political-entities",
      label: {
        en: "Political Entity",
        fr: "Entité politique",
      },
      admin: {
        position: "sidebar",
      },
    },
    imageField({
      label: {
        en: "Image",
        fr: "Image",
      },
    }),
    {
      name: "publishStatus",
      type: "text",
      admin: {
        position: "sidebar",
      },
    },
  ],
  versions: true,
};
