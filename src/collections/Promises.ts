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
    defaultColumns: ["title", "statusLabel", "state", "lastPublished"],
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
      name: "headline",
      type: "text",
      label: {
        en: "Headline",
        fr: "Titre court",
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
      name: "text",
      type: "textarea",
      label: {
        en: "Text",
        fr: "Texte",
      },
    },
    {
      name: "introduction",
      type: "textarea",
      label: {
        en: "Introduction",
        fr: "Introduction",
      },
    },
    {
      name: "statusLabel",
      type: "text",
      label: {
        en: "Status Label",
        fr: "Libellé du statut",
      },
      admin: {
        position: "sidebar",
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
      name: "themeColor",
      type: "text",
      label: {
        en: "Theme Color",
        fr: "Couleur du thème",
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
      name: "imageUrl",
      type: "text",
      admin: {
        hidden: true,
      },
      label: {
        en: "Image Source URL",
        fr: "URL source de l'image",
      },
    },
    {
      name: "publishedArticleUrl",
      type: "text",
      label: {
        en: "Published Article URL",
        fr: "URL de l'article publié",
      },
    },
    {
      name: "useVisualCard",
      type: "checkbox",
      label: {
        en: "Use Visual Card",
        fr: "Utiliser la carte visuelle",
      },
      admin: {
        position: "sidebar",
      },
    },
    {
      name: "state",
      type: "text",
      label: {
        en: "State",
        fr: "État",
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
    {
      name: "lastPublished",
      type: "date",
      admin: {
        date: {
          displayFormat: "yyyy-MM-dd HH:mm",
        },
        position: "sidebar",
      },
      label: {
        en: "Last Published",
        fr: "Dernière publication",
      },
    },
  ],
};
