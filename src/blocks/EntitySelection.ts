import { Block } from "payload";

export const EntitySelection: Block = {
  slug: "entity-selection",
  imageURL: "/cms/entity-selection.png",
  imageAltText: "Entity Selection",
  labels: {
    singular: {
      en: "Entity Selection",
      fr: "Sélection d'entité",
    },
    plural: {
      en: "Entity Selections",
      fr: "Sélections d'entités",
    },
  },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
      defaultValue: "Select an entity to view their promises",
    },
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
};
